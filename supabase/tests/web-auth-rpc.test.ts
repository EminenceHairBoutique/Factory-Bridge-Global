/**
 * Migration 0013 web_auth_rpc (B-05, ADR-041): the `public` wrappers the web tier calls through the Data API, the
 * team-list reader and session revocation on a role change. Every assertion runs as `authenticated` (or `anon`) with
 * the JWT sub claim set; fixtures are inserted by the superuser connection, never used for assertions.
 *
 * The wrappers are SECURITY INVOKER, so each negative test here proves the wrapper adds no privilege of its own:
 * whatever app.* refuses, the wrapper refuses, and anon cannot reach it at all.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "e1000000-0000-4000-8000-000000000001",
  aMember: "e1000000-0000-4000-8000-000000000002",
  aViewer: "e1000000-0000-4000-8000-000000000003",
  bOwner: "e2000000-0000-4000-8000-000000000001",
  sOwner: "e5000000-0000-4000-8000-000000000001",
  opUnassigned: "e3000000-0000-4000-8000-000000000001",
  compliance: "e3000000-0000-4000-8000-000000000002",
  admin: "e3000000-0000-4000-8000-000000000003",
  newcomer: "e4000000-0000-4000-8000-000000000001",
  invitee: "e4000000-0000-4000-8000-000000000002",
};
const EMAIL: Record<keyof typeof U, string> = {
  aOwner: "rpc-a-owner@example.test",
  aMember: "rpc-a-member@example.test",
  aViewer: "rpc-a-viewer@example.test",
  bOwner: "rpc-b-owner@example.test",
  sOwner: "rpc-s-owner@example.test",
  opUnassigned: "rpc-op@example.test",
  compliance: "rpc-compliance@example.test",
  admin: "rpc-admin@example.test",
  newcomer: "rpc-newcomer@example.test",
  invitee: "Rpc-Invitee@Example.test",
};
const ORG = {
  a: "e1aaaaaa-0000-4000-8000-000000000001",
  b: "e2bbbbbb-0000-4000-8000-000000000001",
  s: "e5555555-0000-4000-8000-000000000001",
};

let db: Db;
const ids = (o: Record<string, string>) =>
  Object.values(o)
    .map((v) => `'${v}'`)
    .join(",");

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  // Orgs created through the wrapper in an earlier run on a persistent database belong to these users.
  await db.exec(`delete from public.organizations where created_by in (${ids(U)})`);
  await db.exec(`delete from public.organizations where id in (${ids(ORG)})`);
  await db.exec(`delete from auth.users where id in (${ids(U)})`);
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', '${EMAIL[k as keyof typeof U]}')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name, created_by) values
      ('${ORG.a}', 'buyer', 'RPC Buyer A LLC', 'RPC Buyer A', '${U.aOwner}'),
      ('${ORG.b}', 'buyer', 'RPC Buyer B Inc', 'RPC Buyer B', '${U.bOwner}'),
      ('${ORG.s}', 'supplier', 'RPC 供应商', 'RPC Supplier S', '${U.sOwner}');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'),
      ('${ORG.a}', '${U.aMember}', 'member'),
      ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'),
      ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opUnassigned}', 'operator'),
      ('${INTERNAL_ORG}', '${U.compliance}', 'compliance_reviewer'),
      ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
  `);
});

afterAll(async () => {
  await db.exec(`delete from public.organizations where created_by in (${ids(U)})`);
  await db.exec(`delete from public.organizations where id in (${ids(ORG)})`);
  await db.exec(`delete from auth.users where id in (${ids(U)})`);
  await db.close();
});

/** Run as the `anon` API role (no JWT subject). */
async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const membershipId = async (org: string, user: string) =>
  (
    await db.query<{ id: string }>(
      "select id from public.memberships where org_id = $1 and user_id = $2",
      [org, user],
    )
  )[0]!.id;

const roleOf = async (org: string, user: string) =>
  (
    await db.query<{ role: string; status: string }>(
      "select role::text as role, status from public.memberships where org_id = $1 and user_id = $2",
      [org, user],
    )
  )[0];

describe("anon reaches none of the wrappers", () => {
  it("anon gets permission denied on every wrapper", async () => {
    const calls = [
      `select public.create_organization('buyer', 'Anon LLC', 'Anon')`,
      `select public.create_invite('${ORG.a}', 'x@example.test', 'member')`,
      `select public.accept_invite('whatever')`,
      `select public.update_membership('${ORG.a}', 'member', 'active')`,
      `select * from public.list_org_members('${ORG.a}')`,
    ];
    for (const sql of calls) {
      expect(await asAnon(() => expectError(db, sql)), sql).toMatch(/permission denied/);
    }
  });
});

describe("public.create_organization", () => {
  it("a signed-in newcomer creates a buyer org and becomes its owner", async () => {
    const rows = await asUser(db, U.newcomer, () =>
      db.query<{ id: string }>(
        "select public.create_organization('buyer', 'Newcomer Trading LLC', 'Newcomer') as id",
      ),
    );
    const org = rows[0]!.id;
    expect(await roleOf(org, U.newcomer)).toEqual({ role: "owner", status: "active" });
    // and it is visible to them (RLS), invisible to buyer B
    expect(
      await asUser(db, U.newcomer, () =>
        db.query("select id from public.organizations where id = $1", [org]),
      ),
    ).toHaveLength(1);
    expect(
      await asUser(db, U.bOwner, () =>
        db.query("select id from public.organizations where id = $1", [org]),
      ),
    ).toHaveLength(0);
  });

  it("refuses the internal org type and a caller without a subject", async () => {
    expect(
      await asUser(db, U.newcomer, () =>
        expectError(db, "select public.create_organization('internal', 'Sneaky Ops', 'Ops')"),
      ),
    ).toMatch(/seeded, not created/);
    expect(
      await asUser(db, null, () =>
        expectError(db, "select public.create_organization('buyer', 'Nobody LLC', 'Nobody')"),
      ),
    ).toMatch(/authentication required/);
  });
});

describe("public.create_invite / public.accept_invite", () => {
  it("only owners/admins of the org can invite; another org's owner, a member and a viewer cannot", async () => {
    for (const u of [U.bOwner, U.aMember, U.aViewer, U.opUnassigned, U.sOwner]) {
      expect(
        await asUser(db, u, () =>
          expectError(
            db,
            `select public.create_invite('${ORG.a}', 'someone@example.test', 'member')`,
          ),
        ),
        u,
      ).toMatch(/not authorized to invite/);
    }
  });

  it("an invite is accepted only by the addressed email, once", async () => {
    const token = (
      await asUser(db, U.aOwner, () =>
        db.query<{ t: string }>(
          `select public.create_invite('${ORG.a}', '${EMAIL.invitee}', 'viewer') as t`,
        ),
      )
    )[0]!.t;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(
      await asUser(db, U.bOwner, () => expectError(db, `select public.accept_invite('${token}')`)),
    ).toMatch(/different email/);
    await asUser(db, U.invitee, () => db.query(`select public.accept_invite('${token}')`));
    expect(await roleOf(ORG.a, U.invitee)).toEqual({ role: "viewer", status: "active" });
    expect(
      await asUser(db, U.invitee, () => expectError(db, `select public.accept_invite('${token}')`)),
    ).toMatch(/invalid, used or expired/);
  });
});

describe("public.list_org_members (teammates' emails)", () => {
  const list = (u: string, org: string) =>
    asUser(db, u, () =>
      db.query<{ email: string; role: string }>(
        `select email, role::text as role from public.list_org_members('${org}') order by email`,
      ),
    );

  it("the owner of A lists A's team with emails, and nobody from B", async () => {
    const team = await list(U.aOwner, ORG.a);
    const emails = team.map((r) => r.email);
    expect(emails).toEqual(expect.arrayContaining([EMAIL.aOwner, EMAIL.aMember, EMAIL.aViewer]));
    expect(emails).not.toContain(EMAIL.bOwner);
  });

  it("a platform admin may list any org's team", async () => {
    expect((await list(U.admin, ORG.b)).map((r) => r.email)).toEqual([EMAIL.bOwner]);
  });

  it("refused for a member, a viewer, another buyer, a supplier, an unassigned operator and compliance", async () => {
    for (const u of [U.aMember, U.aViewer, U.bOwner, U.sOwner, U.opUnassigned, U.compliance]) {
      expect(
        await asUser(db, u, () =>
          expectError(db, `select * from public.list_org_members('${ORG.a}')`),
        ),
        u,
      ).toMatch(/not authorized to list members/);
    }
  });

  it("refused without a subject", async () => {
    expect(
      await asUser(db, null, () =>
        expectError(db, `select * from public.list_org_members('${ORG.a}')`),
      ),
    ).toMatch(/not authorized to list members/);
  });
});

describe("public.update_membership", () => {
  it("B's owner, A's member and A's viewer cannot change A's memberships", async () => {
    const target = await membershipId(ORG.a, U.aViewer);
    for (const u of [U.bOwner, U.aMember, U.aViewer, U.opUnassigned]) {
      expect(
        await asUser(db, u, () =>
          expectError(db, `select public.update_membership('${target}', 'admin', 'active')`),
        ),
        u,
      ).toMatch(/not authorized to manage members/);
    }
    expect(await roleOf(ORG.a, U.aViewer)).toEqual({ role: "viewer", status: "active" });
  });

  it("the last owner cannot be demoted through the wrapper", async () => {
    const owner = await membershipId(ORG.a, U.aOwner);
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(db, `select public.update_membership('${owner}', 'admin', 'active')`),
      ),
    ).toMatch(/at least one active owner/);
  });
});

describe("session revocation on a role or status change (memberships_revoke_sessions)", () => {
  const sessionsOf = async (user: string) =>
    (
      await db.query<{ n: number }>(
        "select count(*)::int as n from auth.sessions where user_id = $1",
        [user],
      )
    )[0]!.n;
  const addSession = (user: string) =>
    db.query("insert into auth.sessions (id, user_id) values (gen_random_uuid(), $1)", [user]);

  it("an owner changing a member's role deletes that member's sessions — and only theirs", async () => {
    await addSession(U.aMember);
    await addSession(U.aMember);
    await addSession(U.aOwner);
    await addSession(U.bOwner);
    const target = await membershipId(ORG.a, U.aMember);
    await asUser(db, U.aOwner, () =>
      db.query(`select public.update_membership('${target}', 'viewer', 'active')`),
    );
    expect(await roleOf(ORG.a, U.aMember)).toEqual({ role: "viewer", status: "active" });
    expect(await sessionsOf(U.aMember)).toBe(0);
    expect(await sessionsOf(U.aOwner)).toBeGreaterThan(0);
    expect(await sessionsOf(U.bOwner)).toBeGreaterThan(0);
  });

  it("suspending a member deletes their sessions; a no-op update keeps them", async () => {
    const target = await membershipId(ORG.a, U.aMember);
    await addSession(U.aMember);
    // same role and status: nothing changed, nothing revoked
    await asUser(db, U.aOwner, () =>
      db.query(`select public.update_membership('${target}', 'viewer', 'active')`),
    );
    expect(await sessionsOf(U.aMember)).toBe(1);
    await asUser(db, U.aOwner, () =>
      db.query(`select public.update_membership('${target}', 'viewer', 'suspended')`),
    );
    expect(await roleOf(ORG.a, U.aMember)).toEqual({ role: "viewer", status: "suspended" });
    expect(await sessionsOf(U.aMember)).toBe(0);
  });

  it("a refused change revokes nothing", async () => {
    await addSession(U.aViewer);
    const target = await membershipId(ORG.a, U.aViewer);
    await asUser(db, U.bOwner, () =>
      expectError(db, `select public.update_membership('${target}', 'member', 'active')`),
    );
    expect(await sessionsOf(U.aViewer)).toBe(1);
  });

  it("the member's own change (re-accepting an invite) does not sign them out", async () => {
    // aMember is suspended (previous test); a fresh invite re-activates them as member via accept_invite's upsert
    const token = (
      await asUser(db, U.aOwner, () =>
        db.query<{ t: string }>(
          `select public.create_invite('${ORG.a}', '${EMAIL.aMember}', 'member') as t`,
        ),
      )
    )[0]!.t;
    await addSession(U.aMember);
    await asUser(db, U.aMember, () => db.query(`select public.accept_invite('${token}')`));
    expect(await roleOf(ORG.a, U.aMember)).toEqual({ role: "member", status: "active" });
    expect(await sessionsOf(U.aMember)).toBe(1);
  });

  it("authenticated cannot call the trigger function directly, and cannot touch auth.sessions", async () => {
    expect(
      await asUser(db, U.aOwner, () => expectError(db, "select app.revoke_member_sessions()")),
    ).toMatch(/permission denied|trigger functions can only be called as triggers/);
    expect(await asUser(db, U.aOwner, () => expectError(db, "delete from auth.sessions"))).toMatch(
      /permission denied/,
    );
  });
});
