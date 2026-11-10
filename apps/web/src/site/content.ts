/**
 * Public-site copy (B-31) — one module so the founder and counsel can review every public string in one place,
 * and so content.test.ts can scan all of it for prohibited claims (PRD §7, CLAUDE.md §4, master spec §2.1/§14).
 *
 * Approval status: APPROVED as written by the founder on 2026-11-10 (B-31, PR #37; integration handoff H-17).
 * The headline set follows master spec §2.1 (the PRD §7 "allowed headline set") with two deliberate weakenings:
 * "verified quotations" → "factory-confirmed quotations" (FTC list §14) and "One accountable sourcing workspace"
 * → "One accountable record" (no live workspace yet). Any change to a public string needs founder approval again,
 * and the prohibited-claims guard (claims.ts) still runs on every change. Copy approval is not launch approval:
 * OQ-02 (entity / "U.S.-based"), OQ-06 (privacy policy) and ADR-040 (inquiry delivery) still gate the launch.
 *
 * Rules applied: no "U.S.-based" or location claim; no counters, logos, testimonials, savings, SLAs or response
 * times; no guarantee or certification language; check vocabulary from UX_INFORMATION_ARCHITECTURE.md §4 and
 * QUALITY_ASSURANCE.md; product examples from PILOT_CATEGORY_SELECTION.md (no "raw"/"virgin" hair claims);
 * service-model statements from ADR-026 (adviser, never buyer, reseller or importer of record).
 *
 * English only: the public site is EN (UX IA §2.1). Canonical status terms come from @fbg/i18n so they read
 * exactly as in the workspace. Moving the rest into @fbg/i18n is a handoff for when zh-CN public copy lands.
 */
import { t } from "@fbg/i18n";
import type { CostLineStatus, QuoteTag } from "./design-system";

const en = (key: Parameters<typeof t>[1]) => t("en-US", key);

export const SITE_NAME = en("app.name");

export const META = {
  title: "Factory Bridge Global — sourcing and procurement for U.S. businesses",
  description:
    "Bilingual sourcing support for U.S. businesses working with Chinese manufacturers: structured briefs, factory-confirmed quotations, like-for-like comparisons and documented quality checks. Pilot program.",
};

export const HERO = {
  badge: "Pilot program",
  audience: "For U.S. businesses sourcing from Chinese manufacturers",
  headline: ["Source better.", "Verify quality.", "Know your true cost."] as const,
  lead: "Factory Bridge Global helps U.S. businesses source from Chinese manufacturers with bilingual expertise, qualified supplier options, factory-confirmed quotations and transparent procurement support.",
  primaryCta: "Start a sourcing request",
  secondaryCta: "How it works",
  role: "A buyer-side sourcing service. You choose the supplier and place the order; we are never the buyer, reseller or importer of record.",
};

export const BENEFITS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Direct factory communication",
    body: "Bilingual operators speak with factories in Chinese and keep a record of what was asked and answered.",
  },
  {
    title: "Transparent quote comparisons",
    body: "Quotes are compared only on the same specification, quantity tier and trade term. Anything missing is shown, not filled in.",
  },
  {
    title: "Quality checkpoints",
    body: "Identity reviews, sample approvals and inspections are recorded with a date, a scope and the evidence behind them.",
  },
  {
    title: "One accountable record",
    body: "Your brief, quotes, checks and decisions stay together, with who did what and when.",
  },
];

export const HOW = {
  eyebrow: "How it works",
  title: "A clear process, with a person at every decision.",
  lead: "Five steps from a brief in your own words to a decision you make with the facts in front of you.",
  steps: [
    {
      title: "Brief",
      body: "Describe the product, quantity, destination and timing in your own words. We help turn it into a specification factories can quote against.",
      who: "You, with your sourcing operator",
    },
    {
      title: "Supplier research",
      body: "Operators look for suitable factories through direct contact and manual research, and use supplier catalogs only where the supplier has authorized it, recording where each lead came from.",
      who: "Sourcing operator",
    },
    {
      title: "Quotations",
      body: "Factories quote against the same specification. Each quote keeps its trade term, currency, quantity tiers and validity date.",
      who: "Factories, collected by your operator",
    },
    {
      title: "Comparison and checks",
      body: "Comparable offers are set side by side. Identity reviews, samples and inspections are recorded with their evidence and scope.",
      who: "Operator, reviewed by a person",
    },
    {
      title: "Your decision",
      body: "You decide whether to proceed and with whom. The order and the supply contract are between you and the factory.",
      who: "You",
    },
  ],
  boundaries: [
    {
      title: "What we do",
      body: "Research suppliers, clarify specifications in Chinese and English, collect and compare quotations, and record quality checks.",
    },
    {
      title: "What you decide",
      body: "Which supplier, which quote, whether to order samples and whether to place an order.",
    },
    {
      title: "Between you and the factory",
      body: "The purchase order, payment terms and the supply contract. We are not the buyer, reseller or importer of record.",
    },
  ],
} as const;

export const SERVICES = {
  eyebrow: "Services",
  title: "Four services. Each one ends in something you can review.",
  lead: "A source you can trace, a quote you can compare, a check you can read.",
  items: [
    {
      icon: "search",
      title: "Supplier discovery",
      body: "Candidate factories from direct contact and operator research, plus supplier catalogs where the supplier has authorized their use, each with its source recorded. If we can't find a suitable option, we tell you.",
    },
    {
      icon: "message",
      title: "Bilingual clarification",
      body: "Specification questions drafted in Chinese and English and reviewed by a person before they are sent to a factory.",
    },
    {
      icon: "compare",
      title: "Quote intelligence",
      body: "Like-for-like comparison: the same specification version, the same trade term and named place, the tier for your quantity.",
    },
    {
      icon: "shield",
      title: "Verification and coordination",
      body: "Identity reviews, sample approvals and inspections, each recorded as a check with a date and a scope.",
    },
  ],
  receiveTitle: "What you receive",
  receive: [
    "A written brief and specification that factories quote against",
    "Factory-confirmed quotations with trade term, currency, tiers and validity",
    "A comparison that marks every cost line as sourced, estimated or missing",
    "Check records that say what was checked, when, and what they don't cover",
  ],
} as const;

export const COMPARE = {
  eyebrow: "Quote comparison",
  title: "Compare what matters.",
  lead: "Two quotes are ranked only when the basics match. When they don't, the comparison says so instead of guessing.",
  mustMatchTitle: "Compared only when these match",
  currencyNote:
    "Different currencies are converted at a stated, dated rate, and the original price stays visible. Without a rate, quotes are not ranked.",
  mustMatch: [
    { label: "Specification version", note: "The same drawing, material and finish" },
    { label: "Quantity tier", note: "The price tier for your order size" },
    { label: "Trade term and named place", note: "For example, FOB Ningbo" },
  ],
  costTitle: "Every cost line is labelled",
  costLines: [
    { status: "sourced", note: "From a supplier or logistics quote" },
    { status: "estimated", note: "A documented estimate, labelled as one" },
    { status: "missing", note: "Not quoted yet; requested before you decide" },
    { status: "not_applicable", note: "Covered by the quoted trade term" },
  ] satisfies ReadonlyArray<{ status: CostLineStatus; note: string }>,
  quoteTitle: "Every price says what it is",
  quoteTags: [
    {
      tag: "factory_confirmed_quote",
      note: "Confirmed in writing by the factory for this specification",
    },
    { tag: "indicative_listing", note: "A listed price, not an offer to you" },
    { tag: "quote_expired", note: "Past its validity date; re-quote before relying on it" },
  ] satisfies ReadonlyArray<{ tag: QuoteTag; note: string }>,
};

export const CATEGORIES = {
  eyebrow: "Categories",
  title: "Three product families in the pilot.",
  lead: "Minimum order quantities vary by supplier and are shown on each quote.",
  items: [
    {
      title: "Custom roll labels",
      zh: "定制卷筒不干胶标签",
      example:
        "50 × 76 mm white BOPP, permanent adhesive, CMYK with matte lamination, 500 labels per roll",
    },
    {
      title: "Folding cartons",
      zh: "定制彩盒包装盒",
      example: "Reverse tuck end, 350 gsm SBS board, CMYK with matte varnish, shipped flat",
    },
    {
      title: "Human-hair bundles",
      zh: "真人发发帘",
      example: "100 g double machine weft, 18–22 in, natural straight, natural color 1B",
    },
  ],
  exampleLabel: "Example requirement",
  otherTitle: "Something else?",
  otherBody:
    "Describe it in your sourcing request. Other categories are reviewed before any quote is requested.",
  otherCta: "Describe your product",
  restricted:
    "Medical devices and gloves, sterile vials, pill presses and encapsulators, ingestibles, finished cosmetics and export-sensitive machinery such as HPLC equipment are not available for self-service quoting. Requests in these categories go through a compliance review first.",
};

export const QUALITY = {
  eyebrow: "Quality process",
  title: "Know what was checked.",
  lead: "Every quality statement comes from a check record: what was checked, by whom, on which date, and what it does not cover.",
  checks: [
    {
      label: `${en("badge.identity_reviewed")} (date)`,
      body: "Business license reviewed, unified social credit code matched to the public registry, legal name matched to bank and invoice details, address corroborated. It is not a product test.",
      kind: "check",
    },
    {
      label: en("badge.sample_approved_for_variant"),
      body: "You approved a reference sample for one specification. It applies to that variant only.",
      kind: "check",
    },
    {
      label: `${en("badge.passed_inspection_per_checklist")} vN`,
      body: "A sampled inspection of one batch against a named checklist and sampling plan.",
      kind: "check",
    },
    {
      label: "Contacted",
      body: "Only that: the factory replied. Contacted is not the same as checked.",
      kind: "contact",
    },
  ] as ReadonlyArray<{ label: string; body: string; kind: "check" | "contact" }>,
  limitsTitle: "The limits, stated plainly",
  limits:
    "Inspection samples a batch. It lowers risk but cannot prove that every unit meets the specification, and an approved sample covers one variant, not every production run.",
};

export const ABOUT = {
  eyebrow: "About",
  title: "People do the sourcing. Software keeps the record.",
  lead: "Factory Bridge Global is a sourcing and procurement service for U.S. business buyers working with Chinese manufacturers. Bilingual operators research, clarify and check; every source, quote and check is recorded.",
  isTitle: "How we work",
  is: [
    "Buyer-side: we advise and coordinate for you, and are never the buyer, reseller or importer of record.",
    "Pilot pricing by conversation. Service fees are quoted separately from supplier prices and freight.",
    "Confidential by default: your brief and quotes are visible to your organization and the operators assigned to your project.",
  ],
  notTitle: "What we are not",
  not: [
    "Not a marketplace: there are no listings to browse and no checkout.",
    "Not an automated buyer: no order or payment is made on your behalf.",
    "No scraping: we don't run bots on marketplaces or messaging apps. Supplier information comes from direct contact, supplier-authorized catalogs and manual research, with its source recorded.",
  ],
  entity: "Company and location details are published after legal review.",
};

export const FAQ = {
  eyebrow: "FAQ",
  title: "Questions buyers ask first.",
  items: [
    {
      q: "What is the minimum order quantity?",
      a: "It depends on the supplier and the product. Each quote shows its minimum order quantity alongside the price tier it applies to.",
    },
    {
      q: "How long does sourcing take?",
      a: "It depends on the category and on how complete the specification is. During the pilot we don't publish a standard turnaround; your operator tells you what each step is waiting on.",
    },
    {
      q: "How do you handle quality?",
      a: "Through dated check records: identity reviews, sample approvals and inspections against a named checklist. Inspections sample a batch; they reduce risk but cannot prove that every unit meets the specification.",
    },
    {
      q: "Who can see my brief and quotes?",
      a: "Confidential by default: your organization and the operators assigned to your project. Factories receive the specification you approve for quoting, and each factory sees only its own quote. We don't share your brief or quotes with other buyers.",
    },
    {
      q: "What does it cost?",
      a: "Pilot pricing is agreed by conversation. Service fees are quoted separately from supplier prices and freight.",
    },
    {
      q: "Do you place orders or handle payments?",
      a: "No. You choose the supplier and place the order. The purchase order, payment and supply contract are between you and the factory.",
    },
    {
      q: "Can I sign in to a workspace?",
      a: "Workspace sign-in is not open yet. Pilot access starts with a sourcing request and an introductory call.",
    },
  ],
};

export const CONTACT = {
  eyebrow: "Get started",
  title: "Start a sourcing request",
  lead: "Tell us what you need to source and how to reach you. If it fits the pilot, the next step is an introductory call.",
  nextTitle: "What happens next",
  next: [
    {
      title: "We review your request",
      body: "A sourcing operator reads it and may reply with a clarifying question.",
    },
    {
      title: "Introductory call",
      body: "We talk through the product, quantities, timing and how the pilot works.",
    },
    {
      title: "Pilot scope",
      body: "If we go ahead, we agree the scope and pricing for your pilot.",
    },
  ],
  signInNote: "Workspace sign-in is not open yet; pilot access starts with a sourcing request.",
};

export const FORM = {
  title: "Your sourcing request",
  name: "Name",
  email: "Work email",
  company: "Company",
  productFamily: "Product family",
  productFamilyPlaceholder: "Choose one",
  quantity: "Approximate quantity",
  quantityHint: "For example, 10,000 labels per order",
  message: "What do you need?",
  messageHint: "Product, specification, destination and timing: whatever you know so far.",
  consent: "I agree to be contacted by email about this request.",
  confidentiality:
    "Please don't include confidential drawings, prices or supplier contact details. If we work together, we'll agree a confidential way to share files.",
  privacy: "We use these details only to respond to your request.",
  submit: "Send request",
  submitting: "Sending…",
  closedTitle: "Online requests open when the pilot launches.",
  closedBody:
    "This form isn't connected to an inbox yet, so it is switched off and collects nothing.",
  unreachable: {
    title: "We couldn't reach our server.",
    body: "Your request may not have been sent. Show the form again to resend it with your details; reloading the page clears the form.",
    retry: "Show the form again",
    reload: "Reload the page",
  },
  testModeTitle: "Test mode",
  testModeBody: "Requests are checked but not sent or stored.",
  status: {
    sent: {
      title: "Request sent.",
      body: "Thank you. We'll reply by email.",
    },
    test_sent: {
      title: "Test mode: request checked, not sent.",
      body: "Every field passed validation. Nothing was sent or stored.",
    },
    invalid: {
      title: "Please check the highlighted fields.",
      body: "Nothing was sent.",
    },
    rate_limited: {
      title: "Too many requests from this connection.",
      body: "Please wait a few minutes and try again. Nothing was sent.",
    },
    unavailable: {
      title: "Online requests aren't open yet.",
      body: "Nothing was sent or stored.",
    },
    rejected: {
      title: "We couldn't accept this request.",
      body: "Please review your details and send it again. Nothing was sent.",
    },
    error: {
      title: "We couldn't confirm that your request was sent.",
      body: "Please try again in a few minutes. Sending the same request again won't create a duplicate.",
    },
  },
};

export const FOOTER = {
  tagline:
    "Sourcing and procurement support for U.S. businesses working with Chinese manufacturers.",
  pilot: "Pilot program",
  legal:
    "Company details, terms of service and the privacy policy are published after legal review.",
  appearance: "Appearance",
};

export const NOT_FOUND = {
  title: "Page not found",
  body: "The page you're looking for doesn't exist or has moved.",
  cta: "Back to the home page",
};
