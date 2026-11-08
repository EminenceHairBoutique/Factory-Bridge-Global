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
    href: "/design-preview/buyer/documents",
    title: "Buyer: documents and the upload pipeline",
    body: "Every uploaded or received document with its pipeline status (uploaded → scanning → parsed → extracted → in review → accepted, or rejected), who acts next, the scan result, extraction flags, the linked quotation and the access log; client-side upload pre-check with a simulated pipeline; discard with confirmation.",
    workspace: "Buyer",
  },
  {
    href: "/design-preview/buyer/review?doc=d_quote_h",
    title: "Buyer: extraction review (read-only)",
    body: "The same review split as operations with fewer controls: proposed values with confidence and anchors into the source lines, extraction flags explained in buyer language, flag-for-operator and notes attached to the review task; the accepted variant shows the operator's corrections.",
    workspace: "Buyer",
  },
  {
    href: "/design-preview/buyer/reports",
    title: "Buyer: comparison reports",
    body: "Versioned reports with current / stale / superseded derived from the recorded inputs (brief version, quantity, FX row, exact quotation versions); a generate panel that lists what the next version will contain before it exists; simulated generation; reproducibility facts in the evidence drawer.",
    workspace: "Buyer",
  },
  {
    href: "/design-preview/buyer/report?id=rep_1",
    title: "Buyer: report viewer (stale report)",
    body: "One report rendered as the file reads: header, ranked quotations by trade-term group with selected tier, goods, fees and every landed line with its status, the not-ranked list with reasons, and the footer with assumptions, exclusions, the rounding rule and disclaimers; plus the five export tables with a CSV preview.",
    workspace: "Buyer",
  },
  {
    href: "/design-preview/buyer/messages?thread=th_tooling",
    title: "Buyer: messages and approvals",
    body: "Inbox with needs-you-first ordering and status filters; threads in both languages with translation provenance; the approval chain You → Operator → Sent on every outbound message with approve, edit (approvals reset) and withdraw; a composer that submits to the operator queue over the channels the supplier's recorded contact basis allows; inbound flags (text addressed to the software, contacts removed, links not opened); outbound log with channel, approvers, time and reference.",
    workspace: "Buyer",
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
    href: "/design-preview/buyer/landed-cost",
    title: "Landed cost scenarios",
    body: 'Immutable snapshots citing the exact FX rows and inputs; a new scenario with quantity, as-of date (FX resolved by the 3-day lag rule or missing_fx), a freight estimate (provider or manual; sourced only with a document) and a person-recorded duty assumption (never AI-filled); every landed-cost line per eligible quotation with status and source; a total only when complete, otherwise "Partial — excludes: …"; cross-term ranking only when every eligible total is complete.',
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
    href: "/design-preview/supplier/catalog",
    title: "供应商：产品目录 (supplier catalog, zh-CN)",
    body: "Products with price state and visibility, counts, status tabs and a visibility filter; 新增产品 creates a priced-later product as 待确认; 暂停 / 恢复; the 依据 drawer explains what each visibility means and that unconfirmed prices never reach a buyer.",
    workspace: "Supplier",
  },
  {
    href: "/design-preview/supplier/catalog/import",
    title: "供应商：批量导入 (catalog import, zh-CN)",
    body: "Template download (CSV, UTF-8 with BOM, one row per tier), file or pasted CSV or sample files, a per-product preview with row-numbered Chinese errors and warnings (colloquial trade terms, missing places, overlapping tiers, bad currency, expired dates, invalid scope) and the diff against the catalog, then import of the clean rows as 待确认.",
    workspace: "Supplier",
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
    href: "/design-preview/supplier/messages",
    title: "供应商：消息 (supplier inbox, zh-CN)",
    body: "The supplier's side of the threads: buyer questions in Chinese with the English original and translation provenance, the supplier's replies with their relay state (待平台转达 → 已转达), platform notices, an anonymized buyer label, a reply composer that warns on contact details and prices and routes attachments through the upload pipeline, and the relay log.",
    workspace: "Supplier",
  },
  {
    href: "/design-preview/supplier/documents",
    title: "供应商：文件资料 (supplier documents, zh-CN)",
    body: "Every file the supplier uploaded or the platform attached with its pipeline status, its review state (供应商提供，未核验 until a platform check), expiry, linked record and who can see it; the certification checklist with upload prompts; upload through the shared pre-check with a simulated pipeline; replace as a new version; delete only where the file is not evidence; signed download links that are logged.",
    workspace: "Supplier",
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
    href: "/design-preview/ops/quality",
    title: "Operations: quality verification",
    body: "One checkpoint track per project, supplier and variant through spec, sample, golden sample, production, inspection, exceptions, remediation and closure (QUALITY_ASSURANCE.md §4); the QSR with its sampling plan resolved for the lot (illustrative ISO 2859-1 Level II values), samples and the golden sample agreement, milestones flagged estimated or committed, inspection jobs with the exact badge sentence and findings by class, a result derived from the accept numbers (report required), the shipment-release recommendation, the buyer's decision recorded only against the buyer's message, and the remediation case with the fixed responsibility and resolution vocabulary.",
    workspace: "Internal operations",
  },
  {
    href: "/design-preview/ops/compliance",
    title: "Operations: compliance holds",
    body: 'Holds for blocked and out-of-pilot categories, export-sensitive items, contact disclosure grants and supplier provenance, ordered by urgency with SLA chips; each hold shows its trigger, policy basis, evidence, what the buyer sees (only "Compliance review required") and internal notes; a decision form (release, release with conditions, decline, escalate) that states the downstream effect before recording who, role, when, reason and conditions; a view-as switch shows that operators read and only compliance reviewers and platform admins decide.',
    workspace: "Internal operations",
  },
  {
    href: "/design-preview/ops/research",
    title: "Operations: research inbox",
    body: "Typed observations from manual research (PRD US-O1): fresh-first lead list with staleness after 30 days, each lead's reference, Chinese search term, indicative price range and MOQ labelled internal-only, a record form enforcing the 0005 rules (source register with a blocked entry, required reference, term and date, price and MOQ checks, fixed rights class), dismiss with a reason, and the handoff into supplier creation.",
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
