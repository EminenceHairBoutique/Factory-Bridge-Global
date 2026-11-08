import Link from "next/link";
import { ThemeScope } from "@/design-preview/theme";
import { AppearanceSwitch, DemoStripe } from "@/design-preview/ui/AppShell";

const SCREENS = [
  {
    href: "/design-preview/marketing",
    title: "Marketing home (Obsidian hero)",
    body: "Proposed public home page: Obsidian hero with the bridge mark, then Atlas value, process, categories and evidence sections. Copy subject to approval.",
    workspace: "Public site",
  },
  {
    href: "/design-preview/auth",
    title: "Sign in, invitation and organization setup",
    body: "One-time code first with password second and no account enumeration (EN / 中文); invitation that names the organization and explains the role; three-step buyer organization setup with inline role explanations. Also /auth/invite and /auth/org-setup.",
    workspace: "Access (both)",
  },
  {
    href: "/design-preview/buyer/dashboard",
    title: "Buyer dashboard",
    body: "Projects, required actions, quote status, supplier options and evidence indicators.",
    workspace: "Buyer (English)",
  },
  {
    href: "/design-preview/buyer/new-request",
    title: "New sourcing request",
    body: "Five-step brief wizard: product, quantity and destination, specification and quality, documents, review.",
    workspace: "Buyer (English)",
  },
  {
    href: "/design-preview/buyer/project",
    title: "Project overview",
    body: "Record page for one sourcing project: stage strip, next action, status timeline with who and when, quotes at a glance, and tabs for brief, supplier options, compare, documents, messages with approval chains, reports and audit activity.",
    workspace: "Buyer (English)",
  },
  {
    href: "/design-preview/buyer/brief",
    title: "Brief confirmation (AI proposal → your version)",
    body: "Raw input with highlighted sources, the AI proposal with from input / inferred / missing provenance and Chinese translation, your decisions per field, and a versioned confirm.",
    workspace: "Buyer (English)",
  },
  {
    href: "/design-preview/buyer/compare",
    title: "Supplier quotation comparison",
    body: "Price-basis groups, tiers and MOQ, FX provenance, landed-cost line status, freshness and verification evidence.",
    workspace: "Buyer (English)",
  },
  {
    href: "/design-preview/ops/quote-review",
    title: "Operations: quotation review (concept)",
    body: "Review queue and split view with source anchors, confidence bands and the accept gate.",
    workspace: "Internal operations",
  },
  {
    href: "/design-preview/supplier/dashboard",
    title: "供应商工作台 (Supplier dashboard)",
    body: "待处理询价、待确认价格、即将过期报价、企业认证状态。Simplified-Chinese first; buyers shown as 平台买家 until a grant exists.",
    workspace: "供应商（zh-CN）",
  },
  {
    href: "/design-preview/supplier/onboarding",
    title: "企业资料与认证 (Supplier onboarding)",
    body: "Five-step 企业认证: company identity with a check-digit-validated 统一社会信用代码, authorized representative with contact basis, documents labelled 供应商提供，未核验 until reviewed, trade readiness, consent. Opens in the 需补充 state.",
    workspace: "供应商（zh-CN）",
  },
  {
    href: "/design-preview/supplier/pricing",
    title: "阶梯报价 (Price tier editor)",
    body: "Ascending non-overlapping tiers with inline validation, Incoterm code plus 指定地点, colloquial 出厂价 never defaulted to EXW, validity required, visibility intent.",
    workspace: "供应商（zh-CN）",
  },
  {
    href: "/design-preview/supplier/rfqs",
    title: "询价单 / 提交报价 (RFQ inbox and quote form)",
    body: "Buyer-confirmed specification read-only in both languages, clarification thread via the platform, structured quote form with a submission gate, decline flow.",
    workspace: "供应商（zh-CN）",
  },
  {
    href: "/design-preview/supplier/sharing",
    title: "数据共享设置 (Data-sharing settings)",
    body: "Per-field 仅内部 / 平台买家 / 指定买家, contacts locked behind a separate disclosure grant, recorded grants with revocation effects explained.",
    workspace: "供应商（zh-CN）",
  },
  {
    href: "/design-preview/ops/queue",
    title: "Operations: work queue and pipeline",
    body: "Everything waiting on an operator ordered by SLA, with claim, inline outbound approval (buyer approved → operator → sent via platform), supplier-reply relay, kind and project filters, and a pipeline board of projects by stage with per-stage targets.",
    workspace: "Internal operations",
  },
  {
    href: "/design-preview/ops/suppliers",
    title: "Operations: supplier CRM",
    body: "Sortable supplier list with stage, checks due, catalog grant and assignment, and the supplier record: claimed vs verified profile, facilities, restricted contacts with contact basis and disclosure grants, checks that generate the buyer badge, documents with rights class, source-permission editor.",
    workspace: "Internal operations",
  },
  {
    href: "/design-preview/gallery",
    title: "Component gallery",
    body: "Every primitive in Atlas and Obsidian side by side: buttons, inputs, badges with evidence, stepper, quote status tags, tabs, notices, empty / loading / error states.",
    workspace: "Design system",
  },
];

export default function DesignPreviewIndex() {
  return (
    <ThemeScope className="min-h-dvh">
      <DemoStripe />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate">Track UX-01 · Atlas × Obsidian design preview</p>
          <AppearanceSwitch />
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.01em]">
          Factory Bridge Global prototypes
        </h1>
        <p className="mt-3 max-w-xl text-base text-slate">
          Interactive, local-state prototypes of the buyer workspace and one operations concept.
          Nothing here reads from a database, calls an API or uploads a file. Every record is
          synthetic and labelled as demo data. These routes return 404 in production builds.
        </p>
        <ul className="mt-8 divide-y divide-line rounded-(--fbg-radius-card) border border-line bg-surface">
          {SCREENS.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="flex items-start gap-4 px-5 py-4 hover:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-slate">{s.body}</span>
                </span>
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] text-slate">
                  {s.workspace}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-slate">
          Design documentation lives in <code className="rounded bg-ink/5 px-1">docs/design/</code>.
          Open the screens at phone width to see the bottom tab bar and stacked layouts.
        </p>
      </main>
    </ThemeScope>
  );
}
