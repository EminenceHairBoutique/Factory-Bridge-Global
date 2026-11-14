"use server";

/**
 * Internal staff provisioning for platform admins (B-05b, ADR-043 §4). Invitations go through
 * `public.create_staff_invite` (operator or compliance reviewer only; platform admin at aal2 only, re-checked in SQL);
 * acceptance is the ordinary `/invite/<token>` flow. Role/status changes go through `public.update_membership`, which
 * signs the person out everywhere (migration 0013 trigger). Platform-admin rows, including the caller's own, are not
 * changed here: that stays with the bootstrap runbook. The raw invite token is returned once and never logged.
 */
import { revalidatePath } from "next/cache";
import { canProvisionStaff } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { requestOrigin } from "@/server/auth/origin";
import { isInviteToken } from "@/server/auth/paths";
import {
  fieldErrors,
  formObject,
  staffInviteSchema,
  staffMembershipChangeSchema,
} from "@/server/auth/schemas";
import { STAFF_COPY } from "@/workspace/copy";

const STAFF_PATH = "/ops/admin/staff";

export interface StaffFormState {
  readonly error?: string;
  readonly notice?: string;
  readonly inviteUrl?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export async function createStaffInvite(
  _prev: StaffFormState,
  form: FormData,
): Promise<StaffFormState> {
  const ctx = await requireWorkspace("internal", STAFF_PATH);
  if (!canProvisionStaff(ctx.active.role)) return { error: STAFF_COPY.inviteFailed };
  const parsed = staffInviteSchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { data: token, error } = await ctx.supabase.rpc("create_staff_invite", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) {
    const already = error.code === "23505" || /already belongs/i.test(error.message);
    return { error: already ? STAFF_COPY.alreadyStaff : STAFF_COPY.inviteFailed };
  }
  if (!isInviteToken(token)) return { error: STAFF_COPY.inviteFailed };
  revalidatePath(STAFF_PATH);
  return { inviteUrl: `${await requestOrigin()}/invite/${token}` };
}

export async function changeStaffMembership(
  _prev: StaffFormState,
  form: FormData,
): Promise<StaffFormState> {
  const ctx = await requireWorkspace("internal", STAFF_PATH);
  if (!canProvisionStaff(ctx.active.role)) return { error: STAFF_COPY.changeFailed };
  const parsed = staffMembershipChangeSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: STAFF_COPY.changeFailed };
  // The membership must be a non-admin row of the internal org, and not the caller's own.
  const { data: team, error: listError } = await ctx.supabase.rpc("list_org_members", {
    p_org: ctx.active.orgId,
  });
  const target = team?.find((m) => m.membership_id === parsed.data.membershipId);
  if (listError || !target || target.role === "platform_admin" || target.user_id === ctx.user.id) {
    return { error: STAFF_COPY.changeFailed };
  }
  const { error } = await ctx.supabase.rpc("update_membership", {
    p_membership: parsed.data.membershipId,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
  });
  if (error) return { error: STAFF_COPY.changeFailed };
  revalidatePath(STAFF_PATH);
  return { notice: STAFF_COPY.changeSaved };
}
