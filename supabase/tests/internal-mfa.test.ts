/**
 * Migration 0014 internal_mfa_staff (B-05b, ADR-043): internal roles count only at authenticator assurance level 2,
 * and a platform admin provisions operators / compliance reviewers through `public.create_staff_invite`.
 *
 * Every assertion runs as `authenticated` (or `anon`) with the JWT sub and aal claims set; fixtures are inserted by the
 * superuser connection. "aal1" is what Supabase Auth issues after a password or email-code sign-in; "aal2" only after
 * a TOTP challenge was verified in that session. The point of the RLS half: an operator's password alone, used against
 * the Data API directly (bypassing the web guard), reads nothing an operator could read.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Aal, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "7a000000-0000-4000-8000-000000000001",
  bOwner: "7b000000-0000-4000-8000-000000000001",
  sOwner: "7c000000-0000-4000-8000-000000000001",
  opAssigned: "7d000000-0000-4000-8000-000000000001",
  opSuspended: "7d000000-0000-4000-8000-000000000002",
  compliance: "7d000000-0000-4000-8000-000000000003",
  admin: "7d000000-0000-4000-8000-000000000004",
  dual: "7d000000-0000-4000-8000-000000000005", // owner of buyer B *and* an operator
  newStaff: "7e000000-0000-4000-8000-000000000001",
  stranger: "7e000000-0000-4000-8000-000000000002",
};
const EMAIL: Record<keyof typeof U, string> = {
  aOwner: "mfa-a-owner@example.test",
  bOwner: "mfa-b-owner@example.test",
  sOwner: "mfa-s-owner@example.test",
  opAssigned: "mfa-op@example.test",
  opSuspended: "mfa-op-suspended@example.test",
  compliance: "mfa-compliance@example.test",
  admin: "mfa-admin@example.test",
  dual: "mfa-dual@example.test",
  newStaff: "mfa-new-staff@example.test",
  stranger: "mfa-stranger@example.test",
};
const ORG = {
  a: "7a7a7a7a-0000-4000-8000-000000000001",
  b: "7b7b7b7b-0000-4000-8000-000000000001",
  s: "7c7c7c7c-0000-4000-8000-000000000001",
};
const PROJ = { a: "7f000000-0000-4000-8000-000000000001" };

let db: Db;
const list = (o: Record<string, string>) =>
  Object.values(o)
    .map((v) => `'${v}'`)
    .join(",");

async function cleanUp(): Promise<void> {
  await db.exec(`delete from public.security_events where actor_user_id in (${list(U)})`);
  await db.exec(`delete from public.invites where invited_by in (${list(U)})`);
  await db.exec(`delete from public.organizations where id in (${list(ORG)})`);
  await db.exec(`delete from auth.users where id in (${list(U)})`);
}

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  await cleanUp();
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', '${EMAIL[k as keyof typeof U]}')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name, created_by) values
      ('${ORG.a}', 'buyer', 'MFA Buyer A LLC', 'MFA Buyer A', '${U.aOwner}'),
      ('${ORG.b}', 'buyer', 'MFA Buyer B Inc', 'MFA Buyer B', '${U.bOwner}'),
      ('${ORG.s}', 'supplier', 'MFA 供应商', 'MFA Supplier S', '${U.sOwner}');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'),
      ('${ORG.b}', '${U.bOwner}', 'owner'),
      ('${ORG.b}', '${U.dual}', 'admin'),
      ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opAssigned}', 'operator'),
      ('${INTERNAL_ORG}', '${U.opSuspended}', 'operator'),
      ('${INTERNAL_ORG}', '${U.compliance}', 'compliance_reviewer'),
      ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin'),
      ('${INTERNAL_ORG}', '${U.dual}', 'operator');
    insert into public.sourcing_projects (id, org_id, name, created_by)
      values ('${PROJ.a}', '${ORG.a}', 'MFA kraft mailers', '${U.aOwner}');
    insert into public.project_assignments (project_id, operator_user_id, role, assigned_by) values
      ('${PROJ.a}', '${U.opAssigned}', 'lead', '${U.admin}'),
      ('${PROJ.a}', '${U.opSuspended}', 'support', '${U.admin}');
  `);
  // Suspended after the assignment was made (the 0008 trigger checks membership only on insert/update).
  await db.exec(
    `update public.memberships set status = 'suspended' where org_id = '${INTERNAL_ORG}' and user_id = '${U.opSuspended}'`,
  );
});

afterAll(async () => {
  await cleanUp();
  await db.close();
});

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const as = <T>(user: keyof typeof U, aal: Aal, fn: () => Promise<T>) =>
  asUser(db, U[user], fn, "authenticated", aal);
const flag = async (sql: string) => (await db.query<{ v: boolean }>(`select (${sql}) as v`))[0]!.v;

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

describe("app.session_aal()", () => {
  const aal = async () => (await db.query<{ v: string }>("select app.session_aal() as v"))[0]!.v;

  it("is aal1 without a JWT, aal2 only for an aal2 claim (legacy setting or the claims JSON), aal1 otherwise", async () => {
    expect(await aal()).toBe("aal1");
    try {
      await db.exec("select set_config('request.jwt.claim.aal', 'aal2', false)");
      expect(await aal()).toBe("aal2");
      await db.exec("select set_config('request.jwt.claim.aal', 'AAL2', false)");
      expect(await aal()).toBe("aal1");
      await db.exec("select set_config('request.jwt.claim.aal', '', false)");
      await db.exec(`select set_config('request.jwt.claims', '{"sub":"x","aal":"aal2"}', false)`);
      expect(await aal()).toBe("aal2");
      await db.exec(`select set_config('request.jwt.claims', '{"sub":"x","aal":"aal1"}', false)`);
      expect(await aal()).toBe("aal1");
      await db.exec(`select set_config('request.jwt.claims', '{"sub":"x","aal":"aal3"}', false)`);
      expect(await aal()).toBe("aal1");
    } finally {
      await db.exec("select set_config('request.jwt.claim.aal', '', false)");
      await db.exec("select set_config('request.jwt.claims', '', false)");
    }
  });

  it("anon cannot call it", async () => {
    expect(await asAnon(() => expectError(db, "select app.session_aal()"))).toMatch(
      /permission denied/,
    );
  });
});

describe("internal roles count only at aal2 (RLS, defence in depth behind the web guard)", () => {
  it("the helpers are false for every internal role at aal1 and true at aal2", async () => {
    for (const [user, role] of [
      ["opAssigned", "operator"],
      ["compliance", "compliance_reviewer"],
      ["admin", "platform_admin"],
    ] as const) {
      const check = `app.is_internal() and app.is_member('${INTERNAL_ORG}')
        and app.has_role('${INTERNAL_ORG}', array['${role}']::public.member_role[])
        and app.is_member_of_type('internal')`;
      expect(await as(user, "aal1", () => flag(check)), `${user} at aal1`).toBe(false);
      expect(await as(user, "aal2", () => flag(check)), `${user} at aal2`).toBe(true);
    }
    expect(await as("admin", "aal1", () => flag("app.is_platform_admin()"))).toBe(false);
    expect(await as("admin", "aal2", () => flag("app.is_platform_admin()"))).toBe(true);
  });

  it("an assigned operator reads the project and its assignments only at aal2", async () => {
    const projects = () => count("select 1 from public.sourcing_projects where id = $1", [PROJ.a]);
    const assignments = () =>
      count("select 1 from public.project_assignments where project_id = $1", [PROJ.a]);
    expect(await as("opAssigned", "aal1", projects)).toBe(0);
    expect(await as("opAssigned", "aal1", assignments)).toBe(0);
    expect(
      await as("opAssigned", "aal1", () => flag(`app.is_assigned_to_project('${PROJ.a}')`)),
    ).toBe(false);
    expect(await as("opAssigned", "aal2", projects)).toBe(1);
    expect(await as("opAssigned", "aal2", assignments)).toBe(2);
  });

  it("an active assignment no longer outlives a suspended internal membership (gap closed by 0014)", async () => {
    expect(
      await as("opSuspended", "aal2", () => flag(`app.is_assigned_to_project('${PROJ.a}')`)),
    ).toBe(false);
    expect(
      await as("opSuspended", "aal2", () =>
        count("select 1 from public.sourcing_projects where id = $1", [PROJ.a]),
      ),
    ).toBe(0);
  });

  it("compliance reviewers and platform admins read every project, security events and audit rows only at aal2", async () => {
    for (const user of ["compliance", "admin"] as const) {
      const projects = () =>
        count("select 1 from public.sourcing_projects where id = $1", [PROJ.a]);
      const orgs = () =>
        count("select 1 from public.organizations where id in ($1, $2, $3)", [ORG.a, ORG.b, ORG.s]);
      const audit = () =>
        count("select 1 from public.audit_events where entity_org_id = $1", [ORG.a]);
      expect(await as(user, "aal1", projects), `${user} aal1 projects`).toBe(0);
      expect(await as(user, "aal1", orgs), `${user} aal1 orgs`).toBe(0);
      expect(await as(user, "aal1", audit), `${user} aal1 audit`).toBe(0);
      expect(await as(user, "aal1", () => count("select 1 from public.security_events"))).toBe(0);
      expect(await as(user, "aal2", projects), `${user} aal2 projects`).toBe(1);
      expect(await as(user, "aal2", orgs), `${user} aal2 orgs`).toBe(3);
      expect(await as(user, "aal2", audit), `${user} aal2 audit`).toBeGreaterThan(0);
    }
  });

  it("at aal1 internal staff see their own membership and the internal org's row (for the guard), no teammates", async () => {
    // The web guard's read: own active memberships joined to their organizations, through RLS.
    const guardRead = () =>
      db.query<{ org_type: string; role: string }>(
        `select o.org_type::text, m.role::text from public.memberships m
           join public.organizations o on o.id = m.org_id
          where m.user_id = $1 and m.status = 'active'`,
        [U.opAssigned],
      );
    expect(await as("opAssigned", "aal1", guardRead)).toEqual([
      { org_type: "internal", role: "operator" },
    ]);
    const internalRoster = () =>
      count("select 1 from public.memberships where org_id = $1", [INTERNAL_ORG]);
    expect(await as("opAssigned", "aal1", internalRoster)).toBe(1); // only their own row
    expect(await as("opAssigned", "aal2", internalRoster)).toBeGreaterThan(1);
    expect(await as("opAssigned", "aal1", () => count("select 1 from public.organizations"))).toBe(
      1,
    );
  });

  it("buyer and supplier access needs no MFA; a buyer admin who is also an operator keeps only the buyer side at aal1", async () => {
    expect(
      await as("aOwner", "aal1", () =>
        count("select 1 from public.sourcing_projects where id = $1", [PROJ.a]),
      ),
    ).toBe(1);
    expect(await as("sOwner", "aal1", () => flag(`app.is_member('${ORG.s}')`))).toBe(true);
    expect(
      await as("dual", "aal1", () =>
        flag(`app.has_role('${ORG.b}', array['admin']::public.member_role[])`),
      ),
    ).toBe(true);
    expect(await as("dual", "aal1", () => flag("app.is_internal()"))).toBe(false);
    expect(
      await as("dual", "aal1", () =>
        count("select 1 from public.organizations where id = $1", [ORG.a]),
      ),
    ).toBe(0);
    expect(await as("dual", "aal2", () => flag("app.is_internal()"))).toBe(true);
  });

  it("a platform admin at aal1 cannot list a team or change a membership", async () => {
    expect(
      await as("admin", "aal1", () =>
        expectError(db, "select * from public.list_org_members($1)", [ORG.a]),
      ),
    ).toMatch(/not authorized/);
    const opMembership = (
      await db.query<{ id: string }>(
        "select id from public.memberships where org_id = $1 and user_id = $2",
        [INTERNAL_ORG, U.opAssigned],
      )
    )[0]!.id;
    expect(
      await as("admin", "aal1", () =>
        expectError(db, "select public.update_membership($1, 'compliance_reviewer', 'active')", [
          opMembership,
        ]),
      ),
    ).toMatch(/not authorized/);
  });
});

describe("public.create_staff_invite (B-05b staff provisioning)", () => {
  const invite = (email: string, role: string) =>
    db.query<{ token: string }>("select public.create_staff_invite($1, $2) as token", [
      email,
      role,
    ]);

  it("anon cannot reach it", async () => {
    expect(
      await asAnon(() =>
        expectError(db, "select public.create_staff_invite('x@example.test', 'operator')"),
      ),
    ).toMatch(/permission denied/);
  });

  it("refused for a platform admin at aal1, operators, compliance, buyer and supplier owners, and no subject", async () => {
    const sql = "select public.create_staff_invite('someone@example.test', 'operator')";
    for (const [user, aal] of [
      ["admin", "aal1"],
      ["opAssigned", "aal2"],
      ["compliance", "aal2"],
      ["aOwner", "aal2"],
      ["sOwner", "aal2"],
      ["dual", "aal2"],
    ] as const) {
      expect(await as(user, aal, () => expectError(db, sql)), `${user} ${aal}`).toMatch(
        /not authorized to invite internal staff/,
      );
    }
    expect(await asUser(db, null, () => expectError(db, sql))).toMatch(/not authorized/);
    expect(await count("select 1 from public.invites where email = 'someone@example.test'")).toBe(
      0,
    );
  });

  it("grants only operator or compliance_reviewer, to a well-formed address that is not already active staff", async () => {
    for (const role of ["platform_admin", "owner", "admin", "member", "viewer"]) {
      expect(
        await as("admin", "aal2", () =>
          expectError(db, "select public.create_staff_invite('x@example.test', $1)", [role]),
        ),
        role,
      ).toMatch(/only grant operator or compliance_reviewer/);
    }
    for (const bad of [
      "",
      "no-at-sign",
      "a@b",
      "two words@example.test",
      `${"x".repeat(250)}@example.test`,
    ]) {
      expect(
        await as("admin", "aal2", () =>
          expectError(db, "select public.create_staff_invite($1, 'operator')", [bad]),
        ),
        bad,
      ).toMatch(/invalid email/);
    }
    expect(
      await as("admin", "aal2", () =>
        expectError(db, "select public.create_staff_invite($1, 'operator')", [
          " MFA-OP@Example.test ",
        ]),
      ),
    ).toMatch(/already belongs to active internal staff/);
  });

  it("a platform admin at aal2 gets a single-use token bound to the email for 72 h, recorded as privileged access", async () => {
    const [row] = await as("admin", "aal2", () =>
      invite(" MFA-New-Staff@Example.test ", "operator"),
    );
    expect(row!.token).toMatch(/^[0-9a-f]{64}$/);
    const [stored] = await db.query<{
      org_id: string;
      email: string;
      role: string;
      invited_by: string;
      hours: string;
      raw_stored: boolean;
    }>(
      `select org_id, email, role::text as role, invited_by,
              round(extract(epoch from (expires_at - created_at)) / 3600)::text as hours,
              token_hash = $1 as raw_stored
         from public.invites where invited_by = $2 order by created_at desc limit 1`,
      [row!.token, U.admin],
    );
    expect(stored).toMatchObject({
      org_id: INTERNAL_ORG,
      email: "mfa-new-staff@example.test",
      role: "operator",
      invited_by: U.admin,
      hours: "72",
      raw_stored: false,
    });
    const events = await db.query<{ kind: string; action: string; role: string }>(
      `select kind, details ->> 'action' as action, details ->> 'role' as role
         from public.security_events where actor_user_id = $1 and org_id = $2`,
      [U.admin, INTERNAL_ORG],
    );
    expect(events).toContainEqual({
      kind: "privileged_access",
      action: "staff_invite_created",
      role: "operator",
    });

    // Another account cannot accept it; the addressed person can, once; they are staff only at aal2.
    expect(
      await asUser(db, U.stranger, () =>
        expectError(db, "select public.accept_invite($1)", [row!.token]),
      ),
    ).toMatch(/different email/);
    await as("newStaff", "aal1", () => db.query("select public.accept_invite($1)", [row!.token]));
    const [membership] = await db.query<{ role: string; status: string }>(
      "select role::text as role, status from public.memberships where org_id = $1 and user_id = $2",
      [INTERNAL_ORG, U.newStaff],
    );
    expect(membership).toEqual({ role: "operator", status: "active" });
    expect(
      await as("newStaff", "aal1", () =>
        expectError(db, "select public.accept_invite($1)", [row!.token]),
      ),
    ).toMatch(/invalid, used or expired/);
    expect(await as("newStaff", "aal1", () => flag("app.is_internal()"))).toBe(false);
    expect(await as("newStaff", "aal2", () => flag("app.is_internal()"))).toBe(true);
    // An unassigned new operator sees no buyer project even at aal2 (ADR-035 is unchanged).
    expect(
      await as("newStaff", "aal2", () =>
        count("select 1 from public.sourcing_projects where id = $1", [PROJ.a]),
      ),
    ).toBe(0);
  });

  it("owners still cannot invite internal roles through create_invite", async () => {
    expect(
      await as("aOwner", "aal2", () =>
        expectError(db, "select public.create_invite($1, 'x@example.test', 'operator')", [ORG.a]),
      ),
    ).toMatch(/buyer\/supplier roles/);
  });
});
