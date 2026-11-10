/**
 * Prohibited public-claim patterns (PRD §7, CLAUDE.md §4, master spec §2.1 / §4 / §14, QUALITY_ASSURANCE.md,
 * BRAND_DIRECTION_V1 §6). Used by the content and rendered-page tests; a match fails CI. Wording that is only
 * allowed with evidence (e.g. "U.S.-based" after OQ-02) stays here until that evidence exists and the founder
 * removes the pattern in a reviewed change. Patterns err on the side of blocking: loosen one only when real,
 * approved copy needs it.
 */
export const PROHIBITED_CLAIMS: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  {
    // Any dash or none: U.S.-based, US based, USA-based, U.S.‑based (non-breaking hyphen), U.S.–based.
    pattern: /\bu\.?\s?s\.?(a\.?)?[\s\p{Pd}‑]?based\b/iu,
    why: "OQ-02: no U.S.-based claim before entity verification",
  },
  {
    pattern:
      /\bbased in (the )?(u\.?\s?s\.?a?\b|united states|america)|\b(operated|run) (from|out of)\b|\b(new jersey|headquartered|located in)\b/i,
    why: "OQ-02: no location claim",
  },
  { pattern: /\b(lowest|best|cheapest)\s+price/i, why: "FTC list (master spec §14)" },
  { pattern: /guarantee/i, why: "no guarantee language (master spec §11, OQ-12)" },
  { pattern: /\bcertified\b/i, why: "QA: never 'certified supplier' / 'factory certified'" },
  {
    pattern:
      /\b(verified|vetted|pre[-\s]?vetted|audited)\s+(factor|supplier|manufacturer|quot|offer|vendor|partner)/i,
    why: "'verified' only with a linked check record",
  },
  { pattern: /\b(gold|trusted|top[-\s]rated)\s+supplier/i, why: "QA: no tier badges" },
  { pattern: /zero[-\s]defects?|defect[-\s]free/i, why: "CLAUDE.md §4" },
  { pattern: /\d\s?%/, why: "no savings or performance percentages" },
  { pattern: /\bsav(e|es|ing|ings)\b/i, why: "no invented savings" },
  {
    pattern: /within\s+\d+\s+(business\s+)?(hours?|days?)/i,
    why: "no response-time promise (OQ-18)",
  },
  { pattern: /\b24\s?\/\s?7\b|\bround[-\s]the[-\s]clock\b/i, why: "no SLA" },
  { pattern: /\breal[-\s]time\b/i, why: "CLAUDE.md §4: no 'real-time' without a connector" },
  { pattern: /testimonial|trusted by|as seen in/i, why: "no testimonials or logos" },
  { pattern: /\b(leading|world[-\s]class|number one)\b/i, why: "unsubstantiated superlative" },
  { pattern: /(^|[^\w#])#\s?1\b/, why: "unsubstantiated superlative (#1)" },
  { pattern: /factory[-\s]direct/i, why: "FTC list (master spec §14)" },
  { pattern: /\b(raw|virgin|remy)\b/i, why: "master spec §4: no raw/virgin hair claims" },
  {
    pattern:
      /medical[-\s]grade|\bsterile\b(?! vials)|\bcompliant\b|\bpharmaceutical\b|\bauthentic\b|pure cotton|food[-\s]grade|\bfda[-\s]?(approved|registered)\b/i,
    why: "master spec §4: product claims need evidence",
  },
  {
    pattern:
      /\b\d[\d,]*\+?\s+(\w+\s+){0,2}(suppliers|factories|manufacturers|buyers|clients|customers|brands)\b|\b(hundreds|thousands) of (\w+\s+)?(suppliers|factories|manufacturers|buyers|clients|customers|brands)\b/i,
    why: "no counters",
  },
  { pattern: /demo data|synthetic/i, why: "no preview vocabulary on the public site" },
];

export function findProhibitedClaims(text: string): string[] {
  return PROHIBITED_CLAIMS.filter((c) => c.pattern.test(text)).map(
    (c) => `${c.pattern.source} — ${c.why}`,
  );
}
