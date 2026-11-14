"use server";

/**
 * Accept an invitation through `public.accept_invite` (ADR-042 §6). app.accept_invite checks the token hash, expiry,
 * single use and that it was issued to the signed-in user's email; this action adds nothing but input validation,
 * the active-org preference and the redirect. The raw token is never logged.
 */
import { redirect } from "next/navigation";
import { WORKSPACE_PATH, workspaceForOrgType } from "@fbg/domain/workspace";
import { setActiveOrgCookie } from "@/server/auth/cookies";
import { loadMemberships, requireSignedIn } from "@/server/auth/guard";
import { isInviteToken } from "@/server/auth/paths";
import { INVITE_COPY } from "@/workspace/copy";

export interface InviteState {
  readonly error?: string;
}

export async function acceptInvite(_prev: InviteState, form: FormData): Promise<InviteState> {
  const token = form.get("token");
  if (!isInviteToken(token)) return { error: INVITE_COPY.malformed };
  const { supabase, user } = await requireSignedIn(`/invite/${token}`);
  const { data: membershipId, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || typeof membershipId !== "string") {
    return {
      error: /different email/i.test(error?.message ?? "")
        ? INVITE_COPY.wrongEmail
        : INVITE_COPY.invalid,
    };
  }
  const joined = (await loadMemberships(supabase, user.id)).find(
    (m) => m.membershipId === membershipId,
  );
  if (!joined) return { error: INVITE_COPY.invalid };
  await setActiveOrgCookie(joined.orgId);
  redirect(WORKSPACE_PATH[workspaceForOrgType(joined.orgType)]);
}
