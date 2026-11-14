/**
 * The synthetic world every spec runs in (B-05, B-05b): two buyer orgs, a supplier org, internal staff (an assigned
 * and an unassigned operator and a platform admin, all with TOTP enrolled; an operator who has not enrolled yet), a
 * newcomer, a buyer invitee and a staff invitee (an account with no membership, provisioned by the platform admin in
 * the UI). Created once per run by global-setup.ts — users through the Supabase Auth admin API, tenancy rows and the
 * operator assignment through SQL as `postgres` (the bootstrap path, ADR-042 §7), TOTP factors through Supabase Auth
 * as each user. Emails carry a per-run id so reruns never collide; the password and the TOTP setup keys are random
 * per run and live only in the git-ignored e2e/.auth/world.json.
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
  "opNoMfa",
  "platformAdmin",
  "staffInvitee",
  "newcomer",
  "invitee",
] as const;
export type UserKey = (typeof USER_KEYS)[number];

/** Internal staff whose TOTP factor global setup enrols and verifies. */
export const ENROLLED_STAFF = ["opAssigned", "opUnassigned", "platformAdmin"] as const;
export type EnrolledStaff = (typeof ENROLLED_STAFF)[number];

export interface WorldUser {
  readonly id: string;
  readonly email: string;
}

export interface TotpFixture {
  /** Base32 setup key returned by Supabase Auth at enrolment. */
  readonly secret: string;
  /** The 30-second step whose code global setup used, so specs never reuse it. */
  readonly lastStep: number;
}

export interface World {
  readonly runId: string;
  readonly password: string;
  readonly users: Readonly<Record<UserKey, WorldUser>>;
  readonly totp: Readonly<Record<EnrolledStaff, TotpFixture>>;
  readonly orgs: { readonly buyerA: string; readonly buyerB: string; readonly supplier: string };
  readonly names: { readonly buyerA: string; readonly buyerB: string; readonly supplier: string };
  readonly projects: { readonly a: string; readonly b: string };
  readonly briefs: { readonly a: string; readonly b: string };
}

export function loadWorld(): World {
  return JSON.parse(readFileSync(WORLD_FILE, "utf8")) as World;
}
