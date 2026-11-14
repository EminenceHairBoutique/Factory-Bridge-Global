import { notFound } from "next/navigation";
import { canProvisionStaff, STAFF_INVITABLE_ROLES } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { WorkspaceShell, roleLabel } from "@/workspace/WorkspaceShell";
import { STAFF_COPY } from "@/workspace/copy";
import { opsNav } from "@/workspace/ops/navigation";
import { StaffInviteForm, StaffMembershipForm, type StaffRole } from "@/workspace/ops/StaffForms";
import { Badge, PageHeader, Panel } from "@/workspace/ui";

export const dynamic = "force-dynamic";

const isStaffRole = (r: string): r is StaffRole =>
  (STAFF_INVITABLE_ROLES as readonly string[]).includes(r);

/**
 * Platform admins only (B-05b, ADR-043 §4). Everyone else in /ops gets the same 404 as an unknown route, and SQL
 * refuses them too (list_org_members, invites RLS, create_staff_invite). requireWorkspace has already required aal2.
 */
export default async function StaffPage() {
  const ctx = await requireWorkspace("internal", "/ops/admin/staff");
  if (!canProvisionStaff(ctx.active.role)) notFound();
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
  if (error || invitesError) throw new Error("staff lookup failed");
  return (
    <WorkspaceShell ctx={ctx} nav={opsNav(ctx.active.role, "staff")}>
      <PageHeader title={STAFF_COPY.title} lead={STAFF_COPY.lead} />
      <Panel title={STAFF_COPY.members}>
        <ul className="flex flex-col divide-y divide-(--fbg-border-divider)">
          {(team ?? []).map((m) => (
            <li
              key={m.membership_id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
              data-testid="staff-row"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.full_name ?? m.email}</span>
                <span className="text-sm text-(--fbg-text-secondary)">{m.email}</span>
                <Badge tone="neutral">{roleLabel("en-US", m.role)}</Badge>
                {m.status === "suspended" ? <Badge tone="warn">Suspended</Badge> : null}
                {m.user_id === ctx.user.id ? <Badge tone="ink">You</Badge> : null}
              </div>
              {m.user_id !== ctx.user.id && isStaffRole(m.role) ? (
                <StaffMembershipForm
                  membershipId={m.membership_id}
                  email={m.email}
                  role={m.role}
                  status={m.status}
                />
              ) : m.role === "platform_admin" ? (
                <p className="text-xs text-(--fbg-text-secondary)">{STAFF_COPY.adminRow}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={STAFF_COPY.inviteTitle}>
        <StaffInviteForm />
      </Panel>
      <Panel title={STAFF_COPY.pending}>
        {invites?.length ? (
          <ul className="flex flex-col gap-2 text-sm" data-testid="staff-pending">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-2">
                <span>{i.email}</span>
                <Badge tone="neutral">{roleLabel("en-US", i.role)}</Badge>
                <span className="text-(--fbg-text-secondary)">
                  expires {i.expires_at.slice(0, 16).replace("T", " ")} UTC
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-(--fbg-text-secondary)">{STAFF_COPY.noPending}</p>
        )}
      </Panel>
    </WorkspaceShell>
  );
}
