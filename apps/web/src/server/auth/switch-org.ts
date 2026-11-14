"use server";

/**
 * Org switcher (B-05, ADR-042 §4). The submitted id is untrusted: it is honoured only if the database returns an
 * active, usable membership for it right now; the cookie it sets is a preference the guard re-checks on every request.
 */
import { redirect } from "next/navigation";
import { eligibleMemberships, workspaceForOrgType, WORKSPACE_PATH } from "@fbg/domain/workspace";
import { setActiveOrgCookie } from "./cookies";
import { requireSignedIn } from "./guard";
import { ONBOARDING_PATH, isUuid } from "./paths";

export async function switchOrganization(form: FormData): Promise<void> {
  const orgId = form.get("orgId");
  const { memberships } = await requireSignedIn(ONBOARDING_PATH);
  const target = isUuid(orgId) ? memberships.find((m) => m.orgId === orgId) : undefined;
  if (!target) redirect(ONBOARDING_PATH);
  const kind = workspaceForOrgType(target.orgType);
  if (!eligibleMemberships([target], kind).length) redirect(ONBOARDING_PATH);
  await setActiveOrgCookie(target.orgId);
  redirect(WORKSPACE_PATH[kind]);
}
