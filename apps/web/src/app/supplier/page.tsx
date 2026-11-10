import { t } from "@fbg/i18n";
import { requireWorkspace } from "@/server/auth/guard";
import { WorkspaceShell, roleLabel } from "@/workspace/WorkspaceShell";
import { KeyValue, Notice, PageHeader, Panel } from "@/workspace/ui";

export const dynamic = "force-dynamic";

/** Supplier workspace foundation (B-05): zh-CN first; no catalog, quote or document features yet. */
export default async function SupplierDashboardPage() {
  const ctx = await requireWorkspace("supplier", "/supplier");
  const zh = "zh-CN" as const;
  return (
    <WorkspaceShell
      ctx={ctx}
      locale={zh}
      nav={[{ href: "/supplier", label: t(zh, "supplier.dashboard.title"), current: true }]}
    >
      <PageHeader
        title={t(zh, "supplier.dashboard.title")}
        lead={t(zh, "supplier.dashboard.lead")}
      />
      <Panel>
        <KeyValue
          items={[
            {
              label: t(zh, "supplier.dashboard.organization"),
              value: ctx.active.orgNameZh ?? ctx.active.orgName,
            },
            { label: t(zh, "supplier.dashboard.role"), value: roleLabel(zh, ctx.active.role) },
          ]}
        />
      </Panel>
      <Notice tone="neutral" title={t(zh, "supplier.dashboard.foundation")} />
    </WorkspaceShell>
  );
}
