# Brand Direction V1 — Atlas × Obsidian

**Status:** approved visual direction (founder, 2026-11-07), implemented in the design preview on branch `design/ux-mobile-foundation` (PR #10). Copy proposals remain subject to legal and business approval. This document extends `docs/design/UX_AUDIT_AND_VISION.md`; where the two differ, this one wins for visual decisions.

## 1. Positioning

Factory Bridge Global is a U.S.-facing, quality-first, bilingual sourcing and procurement service for business buyers working with Chinese manufacturers. It is not a marketplace, a discount storefront, an autonomous purchasing agent or a scraper. The brand must read as **serious procurement tooling with design craftsmanship**: elegant on the surface, powerful underneath.

Emotional target: premium, calm, architectural, confident, cosmopolitan, clear, inviting, precise.

## 2. Two moods, one system

| | Atlas | Obsidian |
|---|---|---|
| Role | Default buyer, supplier and operations workspace | Marketing hero and final CTA; optional whole-app dark appearance |
| Feel | Warm light: ivory canvas, white raised surfaces, deep navy type, deep teal action, sparing copper | Immersive near-black: layered charcoal, silver-white text, mist slate secondary, mint-teal action, sparing champagne |
| Where used | Every application screen by default | Hero and closing band of the public site always; application screens when the user chooses Obsidian or System |
| Never | Dark panels floating in a light workspace | Light cards floating in a dark workspace |

The appearance switch (Atlas · Obsidian · System) lives in the sidebar's bottom area and in the phone navigation sheet. It is a per-person preference stored on the device; the marketing hero ignores it and is always Obsidian by design.

## 3. Design principles

1. **Provenance over decoration.** A price always sits next to its type, basis, confirmation date, validity and source. A converted figure always shows its rate and date.
2. **One action color.** Deep teal (light) or mint-teal (dark) is the only color that means "do this". Copper and champagne are brand highlights: the mark, a pilot badge, the notification dot, never a button that commits something.
3. **Structure encodes meaning.** Comparability groups are the structure of the comparison page. Border styles say sourced, estimated or missing. Numbering appears only on real sequences.
4. **Say what is missing.** Partial totals name what they exclude. Empty states name the next action. Disabled buttons say why.
5. **Restraint on the surface, density where work happens.** Marketing has air and a single big headline; workspaces use 14 px dense metadata and ruled tables.
6. **Bilingual by design.** Chinese appears where the product promises it, in a proper CJK face, never machine-translated filler.

## 4. Emblem concepts

The mark is an abstract bridge: two piers and a single arc with a keystone point, drawn with lines only. It avoids the Great Wall, containers, flags and globes. Implemented as an inline SVG (`BrandMark` in `ui/AppShell.tsx`) and as a thin-line hero figure (`BridgeFigure` in `screens/MarketingHome.tsx`). Three sketch directions were considered:

| Concept | Description | Decision |
|---|---|---|
| A. Arc and piers (chosen) | Single arc over two verticals, keystone dot. Reads at 16 px. | Implemented |
| B. Two nodes, one span | Two circles joined by a horizontal segment with a small rise. More "network" than "bridge". | Reserved as a favicon fallback |
| C. Interlocking brackets | Two square brackets meeting at a shared edge, suggesting a handoff. | Rejected: reads as code |

No licensed or stock assets are used anywhere in the preview.

## 5. Tone of voice

Plain, active, specific. Buttons name outcomes. Errors explain the fix. Nothing claims what has no record. Chinese copy uses the formal business register (您) and keeps Incoterms in Latin letters with a gloss.

Proposed copy (pending approval):

| Placement | Copy |
|---|---|
| Hero | Global sourcing. Without the guesswork. |
| Supporting | Better supplier access. Clearer comparisons. More confident decisions. |
| Primary CTA | Start a sourcing request |
| Secondary CTA | How it works |
| Dashboard | Your sourcing, all in one place. |
| Quote screen | Compare what matters. |
| Evidence | Know what was checked. |

## 6. Do / don't

**Do:** one headline per page; ruled panels; tabular numerals; status with icon and text; approval chains visible; Chinese in Noto Sans SC; the Obsidian hero with CSS-only geometry.

**Don't:** countdowns, sale stickers, 3D or glow, gradient washes beyond the two hero radial tints, oversized glassmorphism, fake testimonials, invented logos or counters, a giant chatbot, infinite supplier grids, "verified factory" without a linked check, star ratings, strike-through prices.

## 7. Copy approval caveat

Every string on the marketing preview is a proposal. The PRD §7 list of prohibited claims applies; "U.S.-based" identity wording waits on OQ-02; pricing stays "by conversation" until OQ-04 is resolved. The preview footer states this.
