import type { AddressInfo } from "node:net";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { healthBody, QueueHealthProbe, startHealthServer } from "./health.js";
import type { ConsumerStatus } from "./queue/consumer.js";
import { FakeQueueStore } from "./queue/testing/fake-store.js";

const log = pino({ level: "silent" });
const QUEUES = ["fbg_documents", "fbg_notifications"];
const running: ConsumerStatus = {
  state: "running",
  inFlight: 1,
  lastPollAt: "2026-11-10T00:00:00.000Z",
  consecutivePollErrors: 0,
};

describe("queue health probe", () => {
  it("connected only when every consumed queue is listed and readable", async () => {
    const store = new FakeQueueStore();
    store.probeResult = QUEUES.map((name) => ({ name, present: true, readable: true }));
    expect(await new QueueHealthProbe(store, QUEUES, log).check()).toEqual({
      status: "connected",
      queues: { fbg_documents: "ok", fbg_notifications: "ok" },
    });
    store.probeResult = [
      { name: "fbg_documents", present: true, readable: false },
      { name: "fbg_notifications", present: false, readable: false },
    ];
    expect(await new QueueHealthProbe(store, QUEUES, log).check()).toEqual({
      status: "degraded",
      queues: { fbg_documents: "unreadable", fbg_notifications: "missing" },
    });
  });

  it("classifies failures without exposing their text", async () => {
    const store = new FakeQueueStore();
    store.probeResult = Object.assign(new Error("permission denied for table meta"), {
      code: "42501",
    });
    expect(await new QueueHealthProbe(store, QUEUES, log).check()).toEqual({
      status: "permission_denied",
    });
    store.probeResult = new Error("connect ECONNREFUSED 10.0.0.5:5432");
    expect(await new QueueHealthProbe(store, QUEUES, log).check()).toEqual({
      status: "unreachable",
    });
  });

  it("is not_configured without a database, and caches results so /health cannot become database load", async () => {
    expect(await new QueueHealthProbe(null, QUEUES, log).check()).toEqual({
      status: "not_configured",
    });
    const store = new FakeQueueStore();
    let calls = 0;
    store.probe = () => {
      calls++;
      return Promise.resolve(QUEUES.map((name) => ({ name, present: true, readable: true })));
    };
    let now = 0;
    const probe = new QueueHealthProbe(store, QUEUES, log, 5_000, () => now);
    await Promise.all([probe.check(), probe.check(), probe.check()]);
    expect(calls).toBe(1);
    now = 4_999;
    await probe.check();
    expect(calls).toBe(1);
    now = 5_000;
    await probe.check();
    expect(calls).toBe(2);
  });
});

describe("health body", () => {
  it("is 200 only when the queues are connected and the consumer is running", () => {
    const connected = { status: "connected" as const, queues: { fbg_documents: "ok" as const } };
    expect(healthBody("t0", "development", connected, running)).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        startedAt: "t0",
        env: "development",
        queue: connected,
        consumer: { state: "running", inFlight: 1, lastPollAt: "2026-11-10T00:00:00.000Z" },
      },
    });
    expect(
      healthBody("t0", "development", connected, { ...running, state: "stopping" }).statusCode,
    ).toBe(503);
    expect(healthBody("t0", "development", { status: "unreachable" }, running).statusCode).toBe(
      503,
    );
    const off = healthBody("t0", "development", { status: "not_configured" }, null);
    expect(off.statusCode).toBe(503);
    expect(off.body.consumer).toEqual({ state: "disabled", inFlight: 0, lastPollAt: null });
  });
});

describe("health server", () => {
  let close: (() => Promise<void>) | null = null;
  afterEach(async () => {
    await close?.();
    close = null;
  });

  it("serves GET /health with the computed status code and 404 elsewhere", async () => {
    let status: 200 | 503 = 503;
    const server = startHealthServer(
      0,
      () =>
        Promise.resolve(healthBody("t0", "development", { status: "not_configured" }, null)).then(
          (h) => ({
            ...h,
            statusCode: status,
          }),
        ),
      log,
    );
    close = () => new Promise((r) => server.close(() => r()));
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let res = await fetch(`${base}/health`);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(((await res.json()) as { queue: unknown }).queue).toEqual({ status: "not_configured" });
    status = 200;
    res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect((await fetch(`${base}/metrics`)).status).toBe(404);
    expect((await fetch(`${base}/health`, { method: "POST" })).status).toBe(404);
  });

  it("answers 503 with a bare body when the probe itself throws", async () => {
    const server = startHealthServer(0, () => Promise.reject(new Error("boom: secret host")), log);
    close = () => new Promise((r) => server.close(() => r()));
    await new Promise((r) => server.once("listening", r));
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/health`);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('{"ok":false}');
  });
});
