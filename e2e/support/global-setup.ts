/**
 * Builds the synthetic world (see world.ts) on the local Supabase stack before any spec runs.
 * Synthetic data only: example.com addresses, invented company names, a random per-run password.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { e2eEnv } from "./env";
import {
  INTERNAL_ORG,
  USER_KEYS,
  WORLD_FILE,
  type UserKey,
  type World,
  type WorldUser,
} from "./world";

export default async function globalSetup(): Promise<void> {
  const env = e2eEnv();
  const runId = randomBytes(4).toString("hex");
  const password = `E2e-${randomBytes(18).toString("base64url")}`;
  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users = {} as Record<UserKey, WorldUser>;
  for (const key of USER_KEYS) {
    const email = `${key.toLowerCase()}+${runId}@e2e.example.com`;
    // The newcomer signs up through the UI; every other account is pre-created and confirmed.
    if (key === "newcomer") {
      users[key] = { id: "", email };
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`e2e: could not create ${key}: ${error?.message}`);
    users[key] = { id: data.user.id, email };
  }

  const orgs = { buyerA: randomUUID(), buyerB: randomUUID(), supplier: randomUUID() };
  const names = {
    buyerA: `Atlas Home Goods ${runId}`,
    buyerB: `Birch Outfitters ${runId}`,
    supplier: `Shenzhen Example Packaging ${runId}`,
  };
  const projects = { a: randomUUID(), b: randomUUID() };
  const briefs = { a: randomUUID(), b: randomUUID() };

  const db = new pg.Client({ connectionString: env.dbUrl });
  await db.connect();
  try {
    await db.query("begin");
    await db.query(
      `insert into public.organizations (id, org_type, legal_name, display_name, display_name_zh, country, created_by)
       values ($1, 'buyer', $2, $2, null, 'US', $5),
              ($3, 'buyer', $4, $4, null, 'US', $6),
              ($7, 'supplier', $8, $8, $9, 'CN', $10)`,
      [
        orgs.buyerA,
        names.buyerA,
        orgs.buyerB,
        names.buyerB,
        users.buyerAOwner.id,
        users.buyerBOwner.id,
        orgs.supplier,
        names.supplier,
        `深圳示例包装 ${runId}`,
        users.supplierOwner.id,
      ],
    );
    const memberships: Array<[string, string, string]> = [
      [orgs.buyerA, users.buyerAOwner.id, "owner"],
      [orgs.buyerA, users.buyerAMember.id, "member"],
      [orgs.buyerA, users.buyerAViewer.id, "viewer"],
      [orgs.buyerB, users.buyerBOwner.id, "owner"],
      [orgs.supplier, users.supplierOwner.id, "owner"],
      [INTERNAL_ORG, users.opAssigned.id, "operator"],
      [INTERNAL_ORG, users.opUnassigned.id, "operator"],
    ];
    for (const [org, user, role] of memberships) {
      await db.query(
        "insert into public.memberships (org_id, user_id, role, status, accepted_at) values ($1, $2, $3, 'active', now())",
        [org, user, role],
      );
    }
    await db.query(
      `insert into public.sourcing_projects (id, org_id, name, created_by) values
         ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        projects.a,
        orgs.buyerA,
        `Kraft mailer boxes ${runId}`,
        users.buyerAOwner.id,
        projects.b,
        orgs.buyerB,
        `Canvas tote bags ${runId}`,
        users.buyerBOwner.id,
      ],
    );
    await db.query(
      `insert into public.buyer_briefs (id, project_id, org_id, raw_input_en, created_by) values
         ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
      [
        briefs.a,
        projects.a,
        orgs.buyerA,
        `Brief A ${runId}: 5,000 printed kraft mailers, 30x20x10 cm.`,
        users.buyerAOwner.id,
        briefs.b,
        projects.b,
        orgs.buyerB,
        `Brief B ${runId}: 2,000 natural canvas totes with a one-colour print.`,
        users.buyerBOwner.id,
      ],
    );
    // Only opAssigned works project A (ADR-035); opUnassigned has no assignment at all.
    await db.query(
      `insert into public.project_assignments (project_id, operator_user_id, role, assigned_by)
       values ($1, $2, 'lead', $2)`,
      [projects.a, users.opAssigned.id],
    );
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    await db.end();
  }

  const world: World = { runId, password, users, orgs, names, projects, briefs };
  mkdirSync(dirname(WORLD_FILE), { recursive: true });
  writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2), { mode: 0o600 });
}
