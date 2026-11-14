"use server";

/**
 * Team management for owners/admins (ADR-042 §4–§6): invitations through `public.create_invite`, role/status changes
 * through `public.update_membership`. The domain policy check here is the first layer; app.create_invite /
 * app.update_membership re-check the role in SQL. A change signs the member out everywhere (migration 0013 trigger).
 * The raw invite token is returned to the inviter once and never logged.
 */
import { revalidatePath } from "next/cache";
import { canManageTeam } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { requestOrigin } from "@/server/auth/origin";
import {
  fieldErrors,
  formObject,
  inviteSchema,
  membershipChangeSchema,
} from "@/server/auth/schemas";
import { BUYER_COPY } from "@/workspace/copy";

const TEAM_PATH = "/app/settings/team";

export interface TeamFormState {
  readonly error?: string;
  readonly notice?: string;
  readonly inviteUrl?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export async function createInvite(_prev: TeamFormState, form: FormData): Promise<TeamFormState> {
  const ctx = await requireWorkspace("buyer", TEAM_PATH);
  if (!canManageTeam(ctx.active.role)) return { error: BUYER_COPY.inviteFailed };
  const parsed = inviteSchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { data: token, error } = await ctx.supabase.rpc("create_invite", {
    p_org: ctx.active.orgId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || typeof token !== "string") return { error: BUYER_COPY.inviteFailed };
  revalidatePath(TEAM_PATH);
  return { inviteUrl: `${await requestOrigin()}/invite/${token}` };
}

export async function changeMembership(
  _prev: TeamFormState,
  form: FormData,
): Promise<TeamFormState> {
  const ctx = await requireWorkspace("buyer", TEAM_PATH);
  if (!canManageTeam(ctx.active.role)) return { error: BUYER_COPY.changeFailed };
  const parsed = membershipChangeSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: BUYER_COPY.changeFailed };
  // The membership must belong to the active org: list_org_members is the owner/admin view of exactly that org.
  const { data: team, error: listError } = await ctx.supabase.rpc("list_org_members", {
    p_org: ctx.active.orgId,
  });
  if (listError || !team?.some((m) => m.membership_id === parsed.data.membershipId)) {
    return { error: BUYER_COPY.changeFailed };
  }
  const { error } = await ctx.supabase.rpc("update_membership", {
    p_membership: parsed.data.membershipId,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
  });
  if (error) return { error: BUYER_COPY.changeFailed };
  revalidatePath(TEAM_PATH);
  return { notice: BUYER_COPY.changeSaved };
}
