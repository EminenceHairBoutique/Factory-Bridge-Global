/**
 * Tenant-isolation and authorization suite (B-07 start; SECURITY_PERMISSION_MATRIX.md §7).
 * Every assertion runs as `authenticated` with the JWT sub claim set — never as service_role — except the
 * tests that explicitly verify service_role behaviour. Fixtures are inserted by the superuser connection
 * (bypasses RLS), which is acceptable for *setup*; it is never used for *assertions*.
 *
 * Engine: PGlite locally (dev-time SQL check); real Postgres in CI (DATABASE_URL). Only the latter is
 * Supabase integration evidence.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "a0000000-0000-4000-8000-000000000001",
  aViewer: "a0000000-0000-4000-8000-000000000002",
  bOwner: "b0000000-0000-4000-8000-000000000001",
  sOwner: "50000000-0000-4000-8000-000000000001", // supplier owner
  opUnassigned: "c0000000-0000-4000-8000-000000000001", // internal operator, no assignments
  compliance: "c0000000-0000-4000-8000-000000000002",
  admin: "c0000000-0000-4000-8000-000000000003", // platform_admin
  newcomer: "d0000000-0000-4000-8000-000000000001", // no memberships yet
  invitee: "d0000000-0000-4000-8000-000000000002",
};
const ORG = {
  a: "aaaaaaaa-0000-4000-8000-000000000001",
  b: "bbbbbbbb-0000-4000-8000-000000000001",
  s: "55555555-0000-4000-8000-000000000001",
};

let db: Db;

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  // Clean any leftovers from a previous run on a persistent DB, then seed fixtures as superuser.
  await db.exec(`delete from public.organizations where id in ('${ORG.a}','${ORG.b}','${ORG.s}')`);
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', '${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name, created_by) values
      ('${ORG.a}', 'buyer', 'Buyer A LLC', 'Buyer A', '${U.aOwner}'),
      ('${ORG.b}', 'buyer', 'Buyer B Inc', 'Buyer B', '${U.bOwner}'),
      ('${ORG.s}', 'supplier', '深圳某包装有限公司', 'Supplier S', '${U.sOwner}');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'),
      ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'),
      ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opUnassigned}', 'operator'),
      ('${INTERNAL_ORG}', '${U.compliance}', 'compliance_reviewer'),
      ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
  `);
});

afterAll(async () => {
  await db.close();
});

const countOrgs = (uid: string | null) =>
  asUser(db, uid, async () =>
    (await db.query<{ id: string }>("select id from public.organizations")).map((r) => r.id).sort(),
  );

describe("organizations — tenant isolation", () => {
  it("buyer A owner sees only org A; buyer B owner sees only org B", async () => {
    expect(await countOrgs(U.aOwner)).toEqual([ORG.a]);
    expect(await countOrgs(U.bOwner)).toEqual([ORG.b]);
  });

  it("buyer A cannot read org B by primary key", async () => {
    const rows = await asUser(db, U.aOwner, () =>
      db.query("select id from public.organizations where id = $1", [ORG.b]),
    );
    expect(rows).toHaveLength(0);
  });

  it("a user with no memberships sees nothing; anonymous (no sub) sees nothing", async () => {
    expect(await countOrgs(U.newcomer)).toEqual([]);
    expect(await countOrgs(null)).toEqual([]);
  });

  it("buyer A cannot UPDATE org B (0 rows affected, no error leak)", async () => {
    await asUser(db, U.aOwner, () =>
      db.exec(`update public.organizations set display_name = 'pwned' where id = '${ORG.b}'`),
    );
    const name = await db.query<{ display_name: string }>(
      "select display_name from public.organizations where id = $1",
      [ORG.b],
    );
    expect(name[0]?.display_name).toBe("Buyer B");
  });

  it("viewer cannot update own org; owner can", async () => {
    await asUser(db, U.aViewer, () =>
      db.exec(`update public.organizations set display_name = 'viewer-edit' where id = '${ORG.a}'`),
    );
    let name = await db.query<{ display_name: string }>(
      "select display_name from public.organizations where id = $1",
      [ORG.a],
    );
    expect(name[0]?.display_name).toBe("Buyer A");
    await asUser(db, U.aOwner, () =>
      db.exec(
        `update public.organizations set display_name = 'Buyer A (edited)' where id = '${ORG.a}'`,
      ),
    );
    name = await db.query<{ display_name: string }>(
      "select display_name from public.organizations where id = $1",
      [ORG.a],
    );
    expect(name[0]?.display_name).toBe("Buyer A (edited)");
  });

  it("ownership-path column org_type is immutable even for the owner (trigger raises)", async () => {
    const err = await asUser(db, U.aOwner, () =>
      expectError(
        db,
        `update public.organizations set org_type = 'internal' where id = '${ORG.a}'`,
      ),
    );
    expect(err).toMatch(/immutable/);
  });

  it("authenticated users cannot INSERT organizations directly (no grant); they must use app.create_organization", async () => {
    const err = await asUser(db, U.newcomer, () =>
      expectError(
        db,
        `insert into public.organizations (org_type, legal_name, display_name) values ('buyer', 'X', 'X')`,
      ),
    );
    expect(err).toMatch(/permission denied/);
  });

  it("internal operator (unassigned) can see org profile rows; platform admin sees all", async () => {
    expect(await countOrgs(U.opUnassigned)).toEqual([INTERNAL_ORG, ORG.a, ORG.b, ORG.s].sort());
    expect(await countOrgs(U.admin)).toEqual([INTERNAL_ORG, ORG.a, ORG.b, ORG.s].sort());
  });

  it("exactly one internal organization can exist (unique partial index)", async () => {
    const err = await expectError(
      db,
      `insert into public.organizations (org_type, legal_name, display_name) values ('internal', 'Second', 'Second')`,
    );
    expect(err).toMatch(/organizations_one_internal|duplicate key/);
  });
});

describe("memberships — who can see teams", () => {
  const seeMembers = (uid: string) =>
    asUser(db, uid, async () =>
      (await db.query<{ org_id: string }>("select org_id from public.memberships")).map(
        (r) => r.org_id,
      ),
    );

  it("buyer A owner sees A's team only (2 rows); never B's", async () => {
    const rows = await seeMembers(U.aOwner);
    expect(rows).toHaveLength(2);
    expect(new Set(rows)).toEqual(new Set([ORG.a]));
  });

  it("unassigned internal operator cannot enumerate buyer teams (sees only internal memberships)", async () => {
    const rows = await seeMembers(U.opUnassigned);
    expect(new Set(rows)).toEqual(new Set([INTERNAL_ORG]));
  });

  it("supplier owner cannot see buyer memberships", async () => {
    expect(new Set(await seeMembers(U.sOwner))).toEqual(new Set([ORG.s]));
  });

  it("buyer B owner cannot INSERT themselves into org A (no grant), nor change A's rows via UPDATE (policy)", async () => {
    const err = await asUser(db, U.bOwner, () =>
      expectError(
        db,
        `insert into public.memberships (org_id, user_id, role) values ('${ORG.a}', '${U.bOwner}', 'owner')`,
      ),
    );
    expect(err).toMatch(/permission denied/);
    await asUser(db, U.bOwner, () =>
      db.exec(`update public.memberships set role = 'viewer' where org_id = '${ORG.a}'`),
    );
    const role = await db.query<{ role: string }>(
      "select role from public.memberships where org_id = $1 and user_id = $2",
      [ORG.a, U.aOwner],
    );
    expect(role[0]?.role).toBe("owner");
  });

  it("role must fit org type: an internal role on a buyer org is rejected (superuser insert)", async () => {
    const err = await expectError(
      db,
      `insert into public.memberships (org_id, user_id, role) values ('${ORG.a}', '${U.newcomer}', 'operator')`,
    );
    expect(err).toMatch(/not valid for a buyer organization/);
  });

  it("membership org_id/user_id are immutable (trigger)", async () => {
    const err = await expectError(
      db,
      `update public.memberships set org_id = '${ORG.b}' where org_id = '${ORG.a}' and user_id = '${U.aViewer}'`,
    );
    expect(err).toMatch(/immutable/);
  });
});

describe("mutation functions", () => {
  it("app.create_organization creates the org, makes the caller owner, and the caller can then read it", async () => {
    const id = await asUser(db, U.newcomer, async () => {
      const r = await db.query<{ id: string }>(
        `select app.create_organization('buyer', 'Newco LLC', 'Newco') as id`,
      );
      return r[0]!.id;
    });
    expect(await countOrgs(U.newcomer)).toEqual([id]);
    const m = await db.query<{ role: string; status: string }>(
      "select role, status from public.memberships where org_id = $1 and user_id = $2",
      [id, U.newcomer],
    );
    expect(m[0]).toEqual({ role: "owner", status: "active" });
    const audits = await db.query<{
      actor_user_id: string;
      acting_as: string;
      entity_table: string;
    }>(
      "select actor_user_id, acting_as, entity_table from public.audit_events where entity_org_id = $1 order by at",
      [id],
    );
    expect(audits.map((a) => a.entity_table).sort()).toEqual(["memberships", "organizations"]); // same tx → same `at`
    expect(audits.every((a) => a.actor_user_id === U.newcomer && a.acting_as === "member")).toBe(
      true,
    );
    await db.exec(`delete from public.organizations where id = '${id}'`);
  });

  it("app.create_organization refuses to create an internal org or run anonymously", async () => {
    expect(
      await asUser(db, U.newcomer, () =>
        expectError(db, `select app.create_organization('internal', 'X', 'X')`),
      ),
    ).toMatch(/seeded/);
    expect(
      await asUser(db, null, () =>
        expectError(db, `select app.create_organization('buyer', 'X', 'X')`),
      ),
    ).toMatch(/authentication required/);
  });

  it("invite lifecycle: owner creates, wrong user denied, right user accepts once, second accept fails", async () => {
    const token = await asUser(db, U.aOwner, async () => {
      const r = await db.query<{ t: string }>(
        `select app.create_invite('${ORG.a}', 'Invitee@example.test', 'member') as t`,
      );
      return r[0]!.t;
    });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // raw token never stored
    const stored = await db.query("select 1 from public.invites where token_hash = $1", [token]);
    expect(stored).toHaveLength(0);
    // wrong user (email mismatch)
    expect(
      await asUser(db, U.bOwner, () => expectError(db, `select app.accept_invite('${token}')`)),
    ).toMatch(/different email/);
    // right user
    await asUser(db, U.invitee, () => db.query(`select app.accept_invite('${token}')`));
    expect(await countOrgs(U.invitee)).toEqual([ORG.a]);
    // replay
    expect(
      await asUser(db, U.invitee, () => expectError(db, `select app.accept_invite('${token}')`)),
    ).toMatch(/invalid, used or expired/);
    // garbage token
    expect(
      await asUser(db, U.invitee, () => expectError(db, `select app.accept_invite('nope')`)),
    ).toMatch(/invalid, used or expired/);
  });

  it("viewer cannot create invites; invites are visible to owner/admin only", async () => {
    expect(
      await asUser(db, U.aViewer, () =>
        expectError(db, `select app.create_invite('${ORG.a}', 'x@example.test', 'member')`),
      ),
    ).toMatch(/not authorized/);
    const asViewer = await asUser(db, U.aViewer, () => db.query("select id from public.invites"));
    expect(asViewer).toHaveLength(0);
    const asOwner = await asUser(db, U.aOwner, () =>
      db.query("select id from public.invites where org_id = $1", [ORG.a]),
    );
    expect(asOwner.length).toBeGreaterThan(0);
    const asB = await asUser(db, U.bOwner, () =>
      db.query("select id from public.invites where org_id = $1", [ORG.a]),
    );
    expect(asB).toHaveLength(0);
  });

  it("expired invite cannot be accepted", async () => {
    const token = await asUser(
      db,
      U.aOwner,
      async () =>
        (
          await db.query<{ t: string }>(
            `select app.create_invite('${ORG.a}', 'newcomer@example.test', 'viewer') as t`,
          )
        )[0]!.t,
    );
    // superuser backdates the expiry (expires_at is otherwise immutable for users)
    await db.exec(`alter table public.invites disable trigger invites_owner_guard`);
    await db.exec(
      `update public.invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where token_hash = encode(sha256(convert_to('${token}','UTF8')),'hex')`,
    );
    await db.exec(`alter table public.invites enable trigger invites_owner_guard`);
    expect(
      await asUser(db, U.newcomer, () => expectError(db, `select app.accept_invite('${token}')`)),
    ).toMatch(/expired/);
  });

  it("role removal takes effect on the next statement (suspend → is_member false)", async () => {
    const mem = await db.query<{ id: string }>(
      "select id from public.memberships where org_id = $1 and user_id = $2",
      [ORG.a, U.invitee],
    );
    await asUser(db, U.aOwner, () =>
      db.query(`select app.update_membership('${mem[0]!.id}', 'member', 'suspended')`),
    );
    expect(await countOrgs(U.invitee)).toEqual([]);
    await asUser(db, U.aOwner, () =>
      db.query(`select app.update_membership('${mem[0]!.id}', 'member', 'active')`),
    );
    expect(await countOrgs(U.invitee)).toEqual([ORG.a]);
  });

  it("the last active owner cannot be demoted or suspended", async () => {
    const mem = await db.query<{ id: string }>(
      "select id from public.memberships where org_id = $1 and user_id = $2",
      [ORG.b, U.bOwner],
    );
    expect(
      await asUser(db, U.bOwner, () =>
        expectError(db, `select app.update_membership('${mem[0]!.id}', 'member', 'active')`),
      ),
    ).toMatch(/at least one active owner/);
  });

  it("buyer B owner cannot manage A's memberships through the function either", async () => {
    const mem = await db.query<{ id: string }>(
      "select id from public.memberships where org_id = $1 and user_id = $2",
      [ORG.a, U.aViewer],
    );
    expect(
      await asUser(db, U.bOwner, () =>
        expectError(db, `select app.update_membership('${mem[0]!.id}', 'owner', 'active')`),
      ),
    ).toMatch(/not authorized/);
  });
});

describe("audit — append-only and unspoofable", () => {
  it("authenticated users cannot INSERT, UPDATE or DELETE audit_events", async () => {
    for (const sql of [
      `insert into public.audit_events (acting_as, entity_table, action) values ('member', 'x', 'spoof')`,
      `update public.audit_events set action = 'tampered'`,
      `delete from public.audit_events`,
    ]) {
      expect(await asUser(db, U.admin, () => expectError(db, sql))).toMatch(/permission denied/);
    }
  });

  it("service_role has no UPDATE/DELETE either", async () => {
    for (const sql of [
      `update public.audit_events set action = 'tampered'`,
      `delete from public.audit_events`,
    ]) {
      expect(await asUser(db, null, () => expectError(db, sql), "service_role")).toMatch(
        /permission denied/,
      );
    }
  });

  it("actor_override is rejected for authenticated users and accepted for service_role", async () => {
    const asUserErr = await asUser(db, U.aOwner, () =>
      expectError(
        db,
        `select app.record_audit_event('t', null, 'x', null, null, null, null, '${U.bOwner}', null)`,
      ),
    );
    expect(asUserErr).toMatch(/only permitted for service_role/);
    const id = await asUser(
      db,
      null,
      async () =>
        (
          await db.query<{ id: string }>(
            `select app.record_audit_event('t', null, 'x', null, null, null, null, '${U.bOwner}', null) as id`,
          )
        )[0]!.id,
      "service_role",
    );
    const row = await db.query<{ actor_user_id: string; acting_as: string }>(
      "select actor_user_id, acting_as from public.audit_events where id = $1",
      [id],
    );
    expect(row[0]).toEqual({ actor_user_id: U.bOwner, acting_as: "system" });
  });

  it("an org update by its owner produces one audit row with actor = owner, acting_as = member; B's owner cannot read it", async () => {
    const before = await db.query<{ n: string }>(
      "select count(*)::text as n from public.audit_events where entity_org_id = $1",
      [ORG.a],
    );
    await asUser(db, U.aOwner, () =>
      db.exec(`update public.organizations set display_name = 'Buyer A' where id = '${ORG.a}'`),
    );
    const after = await db.query<{ n: string }>(
      "select count(*)::text as n from public.audit_events where entity_org_id = $1",
      [ORG.a],
    );
    expect(Number(after[0]!.n) - Number(before[0]!.n)).toBe(1);
    const latest = await db.query<{ actor_user_id: string; acting_as: string; action: string }>(
      "select actor_user_id, acting_as, action from public.audit_events where entity_org_id = $1 order by at desc limit 1",
      [ORG.a],
    );
    expect(latest[0]).toEqual({ actor_user_id: U.aOwner, acting_as: "member", action: "update" });
    const visibleToA = await asUser(db, U.aOwner, () =>
      db.query("select id from public.audit_events where entity_org_id = $1", [ORG.a]),
    );
    expect(visibleToA.length).toBeGreaterThan(0);
    const visibleToB = await asUser(db, U.bOwner, () =>
      db.query("select id from public.audit_events where entity_org_id = $1", [ORG.a]),
    );
    expect(visibleToB).toHaveLength(0);
    const visibleToViewer = await asUser(db, U.aViewer, () =>
      db.query("select id from public.audit_events where entity_org_id = $1", [ORG.a]),
    );
    expect(visibleToViewer).toHaveLength(0);
  });

  it("platform admin actions are labelled acting_as = platform_admin", async () => {
    await asUser(db, U.admin, () =>
      db.exec(
        `update public.organizations set settings = '{"note":"admin"}' where id = '${ORG.b}'`,
      ),
    );
    const latest = await db.query<{ acting_as: string; actor_user_id: string }>(
      "select acting_as, actor_user_id from public.audit_events where entity_org_id = $1 order by at desc limit 1",
      [ORG.b],
    );
    expect(latest[0]).toEqual({ acting_as: "platform_admin", actor_user_id: U.admin });
  });

  it("invite audit rows are redacted: column names only, never the token hash value or the email", async () => {
    const inv = await db.query<{ token_hash: string; email: string }>(
      "select token_hash, email from public.invites limit 1",
    );
    const rows = await db.query<{ diff: { after: Record<string, unknown> | null } }>(
      "select diff from public.audit_events where entity_table = 'invites' and action = 'insert' order by at desc limit 1",
    );
    expect(rows[0]?.diff.after?._redacted).toBe(true);
    const text = JSON.stringify(rows[0]?.diff);
    expect(text).not.toContain(inv[0]!.token_hash);
    expect(text).not.toContain(inv[0]!.email);
    expect(text).not.toMatch(/@example\.test/);
  });

  it("security_events readable by compliance/admin only; document_access_log by internal only", async () => {
    await asUser(db, U.aOwner, () =>
      db.query(`select app.record_security_event('rate_limited', '${ORG.a}', '{"n":1}')`),
    );
    expect(
      await asUser(db, U.aOwner, () => db.query("select id from public.security_events")),
    ).toHaveLength(0);
    expect(
      await asUser(db, U.opUnassigned, () => db.query("select id from public.security_events")),
    ).toHaveLength(0);
    expect(
      (await asUser(db, U.compliance, () => db.query("select id from public.security_events")))
        .length,
    ).toBeGreaterThan(0);
    expect(
      await asUser(db, U.aOwner, () => db.query("select id from public.document_access_log")),
    ).toHaveLength(0);
  });
});

describe("user_profiles", () => {
  it("a user can create and read only their own profile", async () => {
    await asUser(db, U.aOwner, () =>
      db.exec(
        `insert into public.user_profiles (user_id, full_name) values ('${U.aOwner}', 'A Owner')`,
      ),
    );
    expect(
      await asUser(db, U.aOwner, () => db.query("select user_id from public.user_profiles")),
    ).toHaveLength(1);
    expect(
      await asUser(db, U.bOwner, () => db.query("select user_id from public.user_profiles")),
    ).toHaveLength(0);
    expect(
      await asUser(db, U.bOwner, () =>
        expectError(db, `insert into public.user_profiles (user_id) values ('${U.aOwner}')`),
      ),
    ).toMatch(/row-level security|permission denied|duplicate/);
  });
});
