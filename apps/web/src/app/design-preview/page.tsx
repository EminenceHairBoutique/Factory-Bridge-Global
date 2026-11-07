import Link from "next/link";
import { DemoStripe } from "@/design-preview/ui/AppShell";

const SCREENS = [
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
];

export default function DesignPreviewIndex() {
  return (
    <div className="fbg-dp min-h-dvh bg-paper text-ink">
      <DemoStripe />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-[13px] text-slate">Track UX-01 · design preview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.01em]">
          Factory Bridge Global prototypes
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-slate">
          Interactive, local-state prototypes of the buyer workspace and one operations concept.
          Nothing here reads from a database, calls an API or uploads a file. Every record is
          synthetic and labelled as demo data. These routes return 404 in production builds.
        </p>
        <ul className="mt-8 divide-y divide-line rounded-md border border-line bg-surface">
          {SCREENS.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="flex items-start gap-4 px-5 py-4 hover:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
                  <span className="mt-0.5 block text-[13px] text-slate">{s.body}</span>
                </span>
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] text-slate">
                  {s.workspace}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[13px] text-slate">
          Design documentation lives in <code className="rounded bg-ink/5 px-1">docs/design/</code>.
          Open the screens at phone width to see the bottom tab bar and stacked layouts.
        </p>
      </main>
    </div>
  );
}
