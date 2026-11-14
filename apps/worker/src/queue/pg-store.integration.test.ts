/**
 * Worker × real pgmq (B-11). Runs only through vitest.integration.config.ts with DATABASE_URL pointing at a local
 * Supabase stack whose migrations are applied (CI `db` job; locally `supabase start && supabase db reset`). The
 * worker side connects exactly as in production: its own pool, `set local role service_role` per transaction.
 * A separate admin client (the connection role) creates fixtures and inspects queue/ledger tables.
 *
 * It purges the fbg queues between tests, so it refuses any DATABASE_URL that is not a loopback host.
 */
import pg from "pg";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceRoleDb, type ServiceRoleDb } from "../db.js";
import { WORKER_QUEUES, defaultHandlers } from "../handlers/index.js";
import { NOTIFICATION_CREATE } from "../handlers/notifications.js";
import { QueueHealthProbe } from "../health.js";
import { Consumer, type ConsumerOptions, type JobHandler } from "./consumer.js";
import { buildEnvelope, messageHash, type JobEnvelope } from "./envelope.js";
import { PgQueueStore } from "./pg-store.js";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "DATABASE_URL is not set: the worker integration suite needs a local Supabase stack (it never skips silently)",
  );
}
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(host)) {
  throw new Error(`refusing to run the worker integration suite against non-loopback host ${host}`);
}

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const key = (name: string) => `itest:${RUN}:${name}`;
const RETRY_Q = "itest_worker_retry";
const USER_A = "cd100000-0000-4000-8000-000000000001"; // member of ORG
const USER_B = "cd100000-0000-4000-8000-000000000002"; // not a member of ORG
const ORG = "cd1cd1cd-0000-4000-8000-000000000001";
const log = pino({ level: "silent" });

let admin: pg.Client;
let db: ServiceRoleDb;
let store: PgQueueStore;

async function q<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await admin.query<T>(text, params)).rows;
}

function consumer(overrides: Partial<ConsumerOptions> = {}): Consumer {
  return new Consumer({
    store,
    handlers: defaultHandlers(),
    log,
    workerId: "itest-worker",
    concurrency: 2,
    visibilityTimeoutSeconds: 30,
    maxAttempts: 3,
    backoff: { baseSeconds: 0, maxSeconds: 0, jitterRatio: 0 },
    busyRetrySeconds: 30,
    pollIntervalMs: 20,
    jobTimeoutMs: 10_000,
    ...overrides,
  });
}

const notifyEnvelope = (name: string, payload: Record<string, unknown>): JobEnvelope =>
  buildEnvelope(NOTIFICATION_CREATE, key(name), payload);

const ledger = (queue: string, k: string) =>
  q<{
    status: string;
    attempts: number;
    msg_id: string;
    payload_hash: string;
    worker_id: string;
    error: string | null;
  }>(
    "select status, attempts, msg_id::text as msg_id, payload_hash, worker_id, error from public.job_executions where queue = $1 and idempotency_key = $2",
    [queue, k],
  );
const deadLetters = (queue: string) =>
  q<{
    msg_id: string;
    idempotency_key: string | null;
    error: string;
    attempts: number;
    message: unknown;
  }>(
    "select msg_id::text as msg_id, idempotency_key, error, attempts, message from public.jobs_dead_letter where queue = $1 and created_at >= $2 order by created_at",
    [queue, startedAt],
  );
const archived = async (queue: string, msgId: string) =>
  (await q(`select 1 from pgmq."a_${queue}" where msg_id = $1::bigint`, [msgId])).length === 1;
const queued = async (queue: string) =>
  Number((await q<{ n: string }>(`select count(*)::text as n from pgmq."q_${queue}"`))[0]!.n);
const notificationsFor = (user: string) =>
  q<{ kind: string; payload: unknown; dedupe_key: string; org_id: string }>(
    "select kind, payload, dedupe_key, org_id from public.notifications where user_id = $1 order by created_at",
    [user],
  );

let startedAt: Date;

beforeAll(async () => {
  admin = new pg.Client({ connectionString: url });
  await admin.connect();
  startedAt = (await q<{ now: Date }>("select now() as now"))[0]!.now;
  const ext = await q("select 1 from pg_extension where extname = 'pgmq'");
  expect(ext, "pgmq must be installed on the local Supabase stack").toHaveLength(1);

  // fixtures (connection role; RLS does not apply to it on the local stack)
  await q("delete from public.notifications where user_id = any($1::uuid[])", [[USER_A, USER_B]]);
  await q("delete from public.organizations where id = $1", [ORG]);
  await q("delete from auth.users where id = any($1::uuid[])", [[USER_A, USER_B]]);
  await q(
    "insert into auth.users (id, email) values ($1, 'itest-worker-a@example.test'), ($2, 'itest-worker-b@example.test')",
    [USER_A, USER_B],
  );
  await q(
    "insert into public.organizations (id, org_type, legal_name, display_name) values ($1, 'buyer', 'Worker ITest Buyer', 'WI')",
    [ORG],
  );
  await q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'member')", [
    ORG,
    USER_A,
  ]);

  // a scratch queue for retry tests, granted like 0012b grants the fbg queues
  await q("select pgmq.drop_queue($1)", [RETRY_Q]).catch(() => undefined);
  await q("select pgmq.create($1)", [RETRY_Q]);
  await q(`grant select, insert, update, delete on pgmq."q_${RETRY_Q}" to service_role`);
  await q(`grant select, insert on pgmq."a_${RETRY_Q}" to service_role`);
  await q(`grant usage, select on sequence pgmq."q_${RETRY_Q}_msg_id_seq" to service_role`);

  db = await createServiceRoleDb(url, {
    max: 8,
    statementTimeoutMs: 10_000,
    applicationName: "fbg-worker-itest",
  });
  store = new PgQueueStore(db);
});

beforeEach(async () => {
  for (const queue of [...WORKER_QUEUES, RETRY_Q]) await q("select pgmq.purge_queue($1)", [queue]);
});

afterAll(async () => {
  await db?.close();
  if (admin !== undefined) {
    await q("select pgmq.drop_queue($1)", [RETRY_Q]).catch(() => undefined);
    for (const queue of WORKER_QUEUES) await q("select pgmq.purge_queue($1)", [queue]);
    await q("delete from public.job_executions where idempotency_key like $1", [`itest:${RUN}:%`]);
    await q("delete from public.jobs_dead_letter where created_at >= $1", [startedAt]);
    await q("delete from public.notifications where user_id = any($1::uuid[])", [[USER_A, USER_B]]);
    await q("delete from public.organizations where id = $1", [ORG]);
    await q("delete from auth.users where id = any($1::uuid[])", [[USER_A, USER_B]]);
    await admin.end();
  }
});

describe("pgmq connectivity as service_role", () => {
  it("the health probe sees every fbg queue as present and readable", async () => {
    expect(await new QueueHealthProbe(store, WORKER_QUEUES, log).check()).toEqual({
      status: "connected",
      queues: { fbg_documents: "ok", fbg_extraction: "ok", fbg_notifications: "ok", fbg_fx: "ok" },
    });
    expect(
      await new QueueHealthProbe(store, ["fbg_notifications", "fbg_missing"], log).check(),
    ).toEqual({
      status: "degraded",
      queues: { fbg_notifications: "ok", fbg_missing: "missing" },
    });
  });
});

describe("fbg_notifications end to end", () => {
  it("a producer's message becomes one notifications row, a succeeded ledger row and an archived message", async () => {
    const env = notifyEnvelope("e2e", {
      user_id: USER_A,
      org_id: ORG,
      kind: "review_ready",
      data: { document_id: "doc-itest-1" },
    });
    const msgId = await store.send("fbg_notifications", env);

    expect(await consumer().drain()).toEqual(["succeeded"]);

    expect(await notificationsFor(USER_A)).toEqual([
      {
        kind: "review_ready",
        payload: { document_id: "doc-itest-1" },
        dedupe_key: `job:fbg_notifications:${key("e2e")}`,
        org_id: ORG,
      },
    ]);
    expect(await ledger("fbg_notifications", key("e2e"))).toEqual([
      {
        status: "succeeded",
        attempts: 1,
        msg_id: msgId,
        payload_hash: messageHash(env),
        worker_id: "itest-worker",
        error: null,
      },
    ]);
    expect(await archived("fbg_notifications", msgId)).toBe(true);
    expect(await queued("fbg_notifications")).toBe(0);

    // replay: same envelope, new message → acknowledged, nothing new written
    const replay = await store.send("fbg_notifications", env);
    expect(await consumer().drain()).toEqual(["duplicate"]);
    expect(await notificationsFor(USER_A)).toHaveLength(1);
    expect(await ledger("fbg_notifications", key("e2e"))).toHaveLength(1);
    expect(await archived("fbg_notifications", replay)).toBe(true);

    // same key, different content → dead letter; the original row is untouched
    const forged = await store.send(
      "fbg_notifications",
      notifyEnvelope("e2e", { user_id: USER_A, org_id: ORG, kind: "generic", data: { x: 1 } }),
    );
    expect(await consumer().drain()).toEqual(["dead_lettered"]);
    const dl = (await deadLetters("fbg_notifications")).filter((d) => d.msg_id === forged);
    expect(dl).toHaveLength(1);
    expect(dl[0]!.error).toMatch(/^idempotency_key_conflict/);
    expect((await ledger("fbg_notifications", key("e2e")))[0]!.status).toBe("succeeded");
    expect(await notificationsFor(USER_A)).toHaveLength(1);
  });

  it("a recipient outside the organization is refused: dead letter, failed ledger row, no notification", async () => {
    const msgId = await store.send(
      "fbg_notifications",
      notifyEnvelope("non-member", { user_id: USER_B, org_id: ORG, kind: "quote_expired" }),
    );
    expect(await consumer().drain()).toEqual(["dead_lettered"]);
    expect(await notificationsFor(USER_B)).toHaveLength(0);
    const dl = (await deadLetters("fbg_notifications")).filter((d) => d.msg_id === msgId);
    expect(dl).toHaveLength(1);
    expect(dl[0]).toMatchObject({ idempotency_key: key("non-member"), attempts: 1 });
    expect(dl[0]!.error).toMatch(/recipient_not_member/);
    expect(await ledger("fbg_notifications", key("non-member"))).toEqual([
      expect.objectContaining({ status: "failed", attempts: 1 }),
    ]);
    expect(await archived("fbg_notifications", msgId)).toBe(true);
  });

  it("a malformed message is dead-lettered with no idempotency key and never reaches the ledger", async () => {
    const msgId = (
      await q<{ id: string }>(
        "select s::text as id from pgmq.send('fbg_notifications', '{\"hello\":\"world\"}'::jsonb, 0) as s",
      )
    )[0]!.id;
    expect(await consumer().drain()).toEqual(["dead_lettered"]);
    const dl = (await deadLetters("fbg_notifications")).filter((d) => d.msg_id === msgId);
    expect(dl).toEqual([
      expect.objectContaining({ idempotency_key: null, attempts: 1, message: { hello: "world" } }),
    ]);
    expect(dl[0]!.error).toMatch(/^invalid_envelope/);
    expect(
      await q(
        "select 1 from public.job_executions where msg_id = $1::bigint and queue = 'fbg_notifications'",
        [msgId],
      ),
    ).toHaveLength(0);
  });
});

describe("queues without a handler fail closed", () => {
  it("fbg_documents, fbg_extraction and fbg_fx messages are dead-lettered on the first attempt", async () => {
    const ids: Record<string, string> = {};
    for (const queue of ["fbg_documents", "fbg_extraction", "fbg_fx"]) {
      ids[queue] = await store.send(
        queue,
        buildEnvelope("test.job", key(`ni-${queue}`), { id: "x" }),
      );
    }
    expect((await consumer({ concurrency: 3 }).drain()).sort()).toEqual([
      "dead_lettered",
      "dead_lettered",
      "dead_lettered",
    ]);
    for (const [queue, msgId] of Object.entries(ids)) {
      const dl = (await deadLetters(queue)).filter((d) => d.msg_id === msgId);
      expect(dl, queue).toHaveLength(1);
      // fbg_documents has a handler since B-12 / B-13, but it stays off unless the entrypoint enables it
      expect(dl[0]!.error, queue).toMatch(
        queue === "fbg_documents" ? /not_configured/ : /not_implemented/,
      );
      expect((await ledger(queue, key(`ni-${queue}`)))[0], queue).toMatchObject({
        status: "failed",
        attempts: 1,
      });
      expect(await queued(queue), queue).toBe(0);
    }
  });
});

describe("retries, backoff, dead letter and transactions on real pgmq", () => {
  const failing =
    (record: string[]): JobHandler =>
    async (job, { tx }) => {
      record.push(job.idempotencyKey);
      // a write that must be rolled back with the failed attempt
      await tx.query("select app.notify($1::uuid, $2::uuid, 'generic', '{}'::jsonb, $3)", [
        USER_A,
        ORG,
        `itest-rollback:${job.idempotencyKey}:${job.attempt}`,
      ]);
      throw new Error("simulated upstream failure");
    };

  it("a poison message is retried until maxAttempts, then lands in jobs_dead_letter; failed attempts write nothing", async () => {
    const calls: string[] = [];
    const c = consumer({ handlers: new Map([[RETRY_Q, failing(calls)]]) });
    const msgId = await store.send(RETRY_Q, buildEnvelope("test.job", key("poison"), { n: 1 }));

    expect(await c.drain()).toEqual(["retry_scheduled", "retry_scheduled", "dead_lettered"]);
    expect(calls).toHaveLength(3);
    expect(await ledger(RETRY_Q, key("poison"))).toEqual([
      expect.objectContaining({
        status: "failed",
        attempts: 3,
        error: "simulated upstream failure",
      }),
    ]);
    expect(await deadLetters(RETRY_Q)).toEqual([
      expect.objectContaining({ msg_id: msgId, idempotency_key: key("poison"), attempts: 3 }),
    ]);
    const a = await q<{ read_ct: number }>(
      `select read_ct from pgmq."a_${RETRY_Q}" where msg_id = $1::bigint`,
      [msgId],
    );
    expect(a).toEqual([{ read_ct: 3 }]);
    expect(
      await q("select 1 from public.notifications where dedupe_key like $1", [
        `itest-rollback:${key("poison")}:%`,
      ]),
    ).toHaveLength(0);
  });

  it("backoff hides the message: the next read finds nothing until the delay passes", async () => {
    const calls: string[] = [];
    const c = consumer({
      handlers: new Map([[RETRY_Q, failing(calls)]]),
      backoff: { baseSeconds: 60, maxSeconds: 60, jitterRatio: 0 },
    });
    const msgId = await store.send(RETRY_Q, buildEnvelope("test.job", key("backoff"), { n: 1 }));
    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    expect(await c.pollOnce()).toEqual([]);
    const vt = await q<{ ahead: boolean }>(
      `select vt > now() + interval '55 seconds' as ahead from pgmq."q_${RETRY_Q}" where msg_id = $1::bigint`,
      [msgId],
    );
    expect(vt).toEqual([{ ahead: true }]);
    expect((await ledger(RETRY_Q, key("backoff")))[0]).toMatchObject({
      status: "running",
      attempts: 1,
    });
  });

  it("a delivery whose worker died mid-run is taken over after its visibility timeout (attempt 2, one effect)", async () => {
    const env = notifyEnvelope("takeover", { user_id: USER_A, org_id: ORG, kind: "generic" });
    const msgId = await store.send("fbg_notifications", env);
    // the dying worker: read with a 0 s visibility timeout (lapses at once) and claim, then vanish
    const [m] = await store.read("fbg_notifications", 0, 1);
    expect(m!.msgId).toBe(msgId);
    expect(
      await store.claim({
        queue: "fbg_notifications",
        idempotencyKey: key("takeover"),
        msgId,
        payloadHash: messageHash(env),
        workerId: "itest-dead-worker",
      }),
    ).toMatchObject({ kind: "run", attempt: 1 });

    expect(await consumer().drain()).toEqual(["succeeded"]);
    expect((await ledger("fbg_notifications", key("takeover")))[0]).toMatchObject({
      status: "succeeded",
      attempts: 2,
      worker_id: "itest-worker",
    });
    expect(
      (await notificationsFor(USER_A)).filter(
        (n) => n.dedupe_key === `job:fbg_notifications:${key("takeover")}`,
      ),
    ).toHaveLength(1);
  });

  it("a second copy of a key that is in flight is deferred (busy) against the real queue table, then acknowledged", async () => {
    const env = notifyEnvelope("busy", { user_id: USER_A, org_id: ORG, kind: "generic" });
    const first = await store.send("fbg_notifications", env);
    const second = await store.send("fbg_notifications", env);
    const msgs = await store.read("fbg_notifications", 30, 2);
    expect(msgs.map((x) => x.msgId).sort()).toEqual([first, second].sort());
    const m1 = msgs.find((x) => x.msgId === first)!;
    const m2 = msgs.find((x) => x.msgId === second)!;
    await store.claim({
      queue: "fbg_notifications",
      idempotencyKey: key("busy"),
      msgId: first,
      payloadHash: messageHash(env),
      workerId: "itest-holder",
    });
    const c = consumer();
    expect(await c.process(m2)).toBe("busy");
    const vt = await q<{ ahead: boolean }>(
      "select vt > now() + interval '25 seconds' as ahead from pgmq.q_fbg_notifications where msg_id = $1::bigint",
      [second],
    );
    expect(vt).toEqual([{ ahead: true }]);

    expect(await c.process(m1)).toBe("succeeded"); // the holder's own redelivery takes over and finishes
    await store.setVisibility("fbg_notifications", second, 0);
    expect(await c.drain()).toEqual(["duplicate"]);
    expect(
      (await notificationsFor(USER_A)).filter(
        (n) => n.dedupe_key === `job:fbg_notifications:${key("busy")}`,
      ),
    ).toHaveLength(1);
  });
});

describe("the long-running loop", () => {
  it("start() consumes as messages arrive; stop() returns once in-flight work is done", async () => {
    const c = consumer();
    c.start();
    const msgId = await store.send(
      "fbg_notifications",
      notifyEnvelope("loop", { user_id: USER_A, org_id: ORG, kind: "assignment_added" }),
    );
    await vi.waitFor(
      async () =>
        expect((await ledger("fbg_notifications", key("loop")))[0]?.status).toBe("succeeded"),
      { timeout: 10_000, interval: 50 },
    );
    expect(await c.stop(5_000)).toEqual({ abandoned: 0 });
    expect(c.status().state).toBe("stopped");
    expect(await archived("fbg_notifications", msgId)).toBe(true);
  });
});
