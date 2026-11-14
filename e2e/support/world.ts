/**
 * The synthetic world every spec runs in (B-05): two buyer orgs, a supplier org, an assigned and an unassigned
 * internal operator, a newcomer and an invitee. Created once per run by global-setup.ts — users through the Supabase
 * Auth admin API, tenancy rows and the operator assignment through SQL as `postgres` (internal memberships have no
 * self-service path, ADR-042 §7). Emails carry a per-run id so reruns never collide; the password is random per run
 * and lives only in the git-ignored e2e/.auth/world.json.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const WORLD_FILE = fileURLToPath(new URL("../.auth/world.json", import.meta.url));
export const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001"; // supabase/seed.sql

export const USER_KEYS = [
  "buyerAOwner",
  "buyerAMember",
  "buyerAViewer",
  "buyerBOwner",
  "supplierOwner",
  "opAssigned",
  "opUnassigned",
  "newcomer",
  "invitee",
] as const;
export type UserKey = (typeof USER_KEYS)[number];

export interface WorldUser {
  readonly id: string;
  readonly email: string;
}

export interface World {
  readonly runId: string;
  readonly password: string;
  readonly users: Readonly<Record<UserKey, WorldUser>>;
  readonly orgs: { readonly buyerA: string; readonly buyerB: string; readonly supplier: string };
  readonly names: { readonly buyerA: string; readonly buyerB: string; readonly supplier: string };
  readonly projects: { readonly a: string; readonly b: string };
  readonly briefs: { readonly a: string; readonly b: string };
}

export function loadWorld(): World {
  return JSON.parse(readFileSync(WORLD_FILE, "utf8")) as World;
}
