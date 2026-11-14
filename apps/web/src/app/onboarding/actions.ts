"use server";

/**
 * Create a buyer or supplier organization through the `public.create_organization` wrapper (ADR-042 §1). The caller
 * becomes its owner inside app.create_organization; the internal org cannot be created this way (refused in SQL).
 */
import { redirect } from "next/navigation";
import { WORKSPACE_PATH, workspaceForOrgType } from "@fbg/domain/workspace";
import type { Database } from "@fbg/db";
import { setActiveOrgCookie } from "@/server/auth/cookies";
import { requireSignedIn } from "@/server/auth/guard";
import { ONBOARDING_PATH } from "@/server/auth/paths";
import { createOrganizationSchema, fieldErrors, formObject } from "@/server/auth/schemas";
import { ONBOARDING_COPY } from "@/workspace/copy";

export interface OnboardingState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly values?: Readonly<Record<string, string>>;
}

export async function createOrganization(
  _prev: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const { supabase } = await requireSignedIn(ONBOARDING_PATH);
  const values = formObject(form);
  const parsed = createOrganizationSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const args: Database["public"]["Functions"]["create_organization"]["Args"] = {
    p_org_type: parsed.data.orgType,
    p_legal_name: parsed.data.legalName,
    p_display_name: parsed.data.displayName,
    p_country: parsed.data.country,
  };
  if (parsed.data.displayNameZh) args.p_display_name_zh = parsed.data.displayNameZh;
  const { data, error } = await supabase.rpc("create_organization", args);
  if (error || typeof data !== "string") return { error: ONBOARDING_COPY.failed, values };
  await setActiveOrgCookie(data);
  redirect(WORKSPACE_PATH[workspaceForOrgType(parsed.data.orgType)]);
}
