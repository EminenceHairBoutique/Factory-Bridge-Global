import { notFound } from "next/navigation";
import { canManageTeam } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { WorkspaceShell, roleLabel } from "@/workspace/WorkspaceShell";
import { InviteForm, MembershipForm } from "@/workspace/buyer/TeamForms";
import { buyerNav } from "@/workspace/buyer/navigation";
import { BUYER_COPY } from "@/workspace/copy";
import { Badge, PageHeader, Panel } from "@/workspace/ui";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireWorkspace("buyer", "/app/settings/team");
  // Members and viewers get the same 404 as an unknown route; SQL refuses them too (list_org_members, invites RLS).
  if (!canManageTeam(ctx.active.role)) notFound();
  const [{ data: team, error }, { data: invites, error: invitesError }] = await Promise.all([
    ctx.supabase.rpc("list_org_members", { p_org: ctx.active.orgId }),
    ctx.supabase
      .from("invites")
      .select("id, email, role, expires_at")
      .eq("org_id", ctx.active.orgId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (error || invitesError) throw new Error("team lookup failed");
  return (
    <WorkspaceShell ctx={ctx} nav={buyerNav(ctx.active.role, "team")}>
      <PageHeader title={BUYER_COPY.team} lead={BUYER_COPY.teamLead} />
      <Panel title="Members">
        <ul className="flex flex-col divide-y divide-(--fbg-border-divider)">
          {(team ?? []).map((m) => (
            <li
              key={m.membership_id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
              data-testid="member-row"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.full_name ?? m.email}</span>
                <span className="text-sm text-(--fbg-text-secondary)">{m.email}</span>
                <Badge tone="neutral">{roleLabel("en-US", m.role)}</Badge>
                {m.status === "suspended" ? <Badge tone="warn">Suspended</Badge> : null}
                {m.user_id === ctx.user.id ? <Badge tone="ink">You</Badge> : null}
              </div>
              {m.user_id === ctx.user.id ? null : (
                <MembershipForm
                  membershipId={m.membership_id}
                  email={m.email}
                  role={m.role}
                  status={m.status}
                />
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Invite a teammate">
        <InviteForm />
      </Panel>
      <Panel title="Pending invitations">
        {invites?.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-2">
                <span>{i.email}</span>
                <Badge tone="neutral">{roleLabel("en-US", i.role)}</Badge>
                <span className="text-(--fbg-text-secondary)">
                  expires {i.expires_at.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-(--fbg-text-secondary)">No pending invitations.</p>
        )}
      </Panel>
    </WorkspaceShell>
  );
}
