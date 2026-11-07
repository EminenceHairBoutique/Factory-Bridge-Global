// Public landing page — informational only. Copy is limited to the approved set in the master spec §2.1.
// Prohibited until substantiated (PRD §7): "U.S.-based", verified-supplier counts, savings figures, testimonials.

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-24">
      <p className="text-sm font-medium tracking-wide text-teal">
        Sourcing &amp; Procurement for B2B Buyers
      </p>
      <h1 className="text-4xl font-semibold leading-tight text-ink">
        Source Better. Verify Quality. Know Your True Cost.
      </h1>
      <p className="text-lg text-slate">
        Factory Bridge Global helps U.S. businesses source from Chinese manufacturers with bilingual
        expertise, qualified supplier options, verified quotations, and transparent procurement
        support.
      </p>
      <ul className="grid grid-cols-1 gap-3 text-slate sm:grid-cols-2">
        <li className="rounded-md border border-line bg-surface p-4">
          Direct Factory Communication
        </li>
        <li className="rounded-md border border-line bg-surface p-4">
          Transparent Quote Comparisons
        </li>
        <li className="rounded-md border border-line bg-surface p-4">Quality Checkpoints</li>
        <li className="rounded-md border border-line bg-surface p-4">
          One Accountable Sourcing Workspace
        </li>
      </ul>
      <p className="text-sm text-slate">
        Pilot program. Request-a-call form and workspace sign-in arrive with backlog items B-05 and
        B-31.
      </p>
    </main>
  );
}
