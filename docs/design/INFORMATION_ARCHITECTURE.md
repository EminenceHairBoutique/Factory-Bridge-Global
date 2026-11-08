# Information Architecture — Design Track View

This document does not replace `docs/UX_INFORMATION_ARCHITECTURE.md` (the normative sitemap and vocabulary). It records how the design track **renders** that architecture: navigation models per device, page-template usage, state vocabulary and the mapping from prototype routes to real routes.

## 1. Navigation model

### 1.1 Desktop and tablet (≥ 768 px)

```
┌──────────┬────────────────────────────────────────────────────────┬──────────────┐
│ FB rail  │ Top bar: workspace · page title · org switcher · EN/中文 · 🔔 · avatar   │
│ (navy)   ├────────────────────────────────────────────────────────┼──────────────┤
│ Overview │                                                        │ Evidence     │
│ Projects │  Page header (title, lead, meta chips, actions)        │ drawer       │
│ New req. │  Content panels (ruled, no shadow)                     │ (xl only;    │
│ Compare  │                                                        │  below the   │
│ Documents│                                                        │  content on  │
│ …        │                                                        │  smaller)    │
│ Collapse │                                                        │              │
└──────────┴────────────────────────────────────────────────────────┴──────────────┘
```

- The rail collapses to a 64 px icon rail (state kept in component memory; persist per user later).
- Destinations that do not exist yet render as disabled rows labelled "Planned" so the navigation model is visible without pretending.
- The evidence drawer is a slot on the shell. Pages that have a "selected record" (comparison, supplier profile, review) fill it; on narrower screens the same content renders as a panel under the main content.

### 1.2 Phone (< 768 px)

```
┌──────────────────────────────┐
│ ☰  Page title     EN 中文  🔔 │  ← top bar; ☰ opens the full navigation sheet
├──────────────────────────────┤
│ Page header (stacked)        │
│ Panels (stacked, full width) │
│ Sticky action bar (wizard)   │
├──────────────────────────────┤
│ Overview Projects New Compare More │  ← bottom tab bar (4 primary + More)
└──────────────────────────────┘
```

- Four primary destinations per workspace carry a `mobile: true` flag; the fifth tab opens a sheet with everything else.
- The wizard's Back / Save draft / Continue bar sticks above the tab bar.
- Comparison columns become a horizontally snapping carousel of quote cards per comparability group.

### 1.3 Workspace variants

| Workspace | Rail tone | Primary mobile tabs | Notes |
|---|---|---|---|
| Buyer (`/app`) | ink navy | Overview, Projects, New request, Compare | English; locale toggle visual only in prototype |
| Supplier (`/supplier`) | ink navy | 工作台, 询价单, 我的报价, 产品目录 | zh-CN default; specified, not prototyped |
| Operations (`/ops`) | darker navy `#13263d` | Pipeline, Review, Suppliers, Outreach | "Internal workspace" notice on every page |

## 2. Page templates used by the prototypes

| IA §3 template | Prototype | Implementation notes |
|---|---|---|
| AppShell | all | `ui/AppShell.tsx` |
| ListPage | dashboard projects, ops queue | dense table on md+, card list below; filter via segmented control |
| RecordPage | comparison header | title, status chips (brief version, as-of, FX), actions |
| Wizard | new sourcing request | vertical stepper on lg+, horizontal scrollable stepper below; per-step validation; review step lists missing fields |
| ReviewSplit | ops quote review | document pane + field pane; segmented toggle between them on phones |
| ComparisonMatrix | compare | one `<table>` per comparability group; sticky row labels; carousel on phones |
| ApprovalCard | compare → "Request clarification" | ZH/EN draft; send disabled until operator approval |
| BadgeWithEvidence | dashboard, compare, drawer | `<details>` popover: what / who / when / until |
| FreshnessChip | everywhere a date matters | observed / updated / confirmed / valid until / expired |
| StatusLine | landed-cost lines | solid teal (sourced), dashed amber (estimated), double red (missing), grey (included in trade term) |

## 3. Route mapping

| Prototype route (dev only) | Real route (IA §2) | Backlog owner |
|---|---|---|
| `/design-preview/buyer/dashboard` | `/app` | B-15 (projects), B-25 (expiry), B-24 (messages) |
| `/design-preview/buyer/new-request` | `/app/projects/new` | B-15, B-17 (AI structuring), B-27 (compliance holds) |
| `/design-preview/buyer/compare` | `/app/projects/[id]/compare` + `/landed-cost` | B-22 (UI), B-14 (engine), B-21 (FX/freight/duty), B-23 (report) |
| `/design-preview/ops/quote-review` | `/ops/review`, `/ops/review/[taskId]` | B-20 |

## 4. State vocabulary rendered by the design system

| Concept | States | Rendering |
|---|---|---|
| Project stage (demo) | brief draft → brief confirmed → finding options → quotes in review → comparison ready → sample requested → awaiting approval | 7-segment progress strip + "step n of 7" text |
| Quote type (`quote_type`) | Indicative listing · Supplier catalog price · Factory-confirmed quote · Estimate | teal badge with check; listings/estimates never ranked |
| Validity | valid until date · validity unconfirmed · expired date | FreshnessChip; warn / danger badge |
| Cost line (`cost_line_status`) | sourced · estimated · missing · not_applicable | StatusLine marker + `status.*` strings from `@fbg/i18n` |
| Landed total | complete · partial | amount + "Estimated landed cost" badge, or "Partial — excludes: …" |
| Exclusion reasons | expired · below_moq · hard_mismatch · no_tier_covers_qty · basis_unknown | red text under the supplier header; quote shown in the "Not ranked" group |
| Verification evidence | identity reviewed (date) · sample approved for variant · no record | EvidenceBadge, or neutral "No verification record yet" |
| Extraction confidence | high · medium · low | three-segment band + text |
| Review gate | missing: currency / unit / tier / basis | warn notice; Accept disabled |

## 5. Copy rules applied

- Sentence case everywhere; no all-caps labels.
- Buttons name the outcome: "Submit request", "Accept as v1", "Request clarification", "Apply forwarder estimate".
- Errors say what to do: "Enter a 5-digit U.S. ZIP code."
- Nothing says "cheapest". The labels are "Lowest comparable goods cost" and "Lowest estimated landed cost (all inputs present)" (QUOTE_ENGINE_SPEC §2.7).
- Chinese appears where the product promises it: the optional 中文 description, the bilingual clarification draft, and the synthetic Chinese quotation sheet in the review concept. Incoterms stay in Latin letters.
