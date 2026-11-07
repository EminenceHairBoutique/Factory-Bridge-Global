# PILOT CATEGORY SELECTION

**Status:** Phase 0 recommendation for founder approval (OQ-15). Scores are structured hypotheses from the research docs and the founder's stated experience; they are **not** market data. Validate with the interview plan in §5 before committing engineering time to category-specific templates.

## 1. Recommendation (one-to-three families)

| Priority | Pilot | Families | Why |
|---|---|---|---|
| **Pilot A (primary)** | **Custom printed packaging** | 1. Custom pressure-sensitive roll labels; 2. Printed folding cartons | Same buyers (small beauty/apparel/e-commerce brands), often the same or adjacent suppliers, highly specifiable (dieline, material, GSM, finish), visually inspectable pre-shipment, low regulatory burden, recurring reorders, light/dense freight. The two families share one QSR structure and one comparison schema, so they cost ~1.3× one family to build, not 2×. |
| **Pilot B (parallel, founder-expertise)** | **Human-hair bundles** | 5. Human-hair bundles/wefts | The founder already operates a hair brand and holds supplier relationships, so a real buyer tenant, real authorized quotes and real sample/QA evidence exist from day one without external recruiting. High unit value makes landed-cost and QA value visible. Risks (origin/forced-labor documentation, grading subjectivity) are real and are exactly what the QA model is designed to surface; it is a strong test of badge honesty. Scope: bundles only; lace wigs deferred (construction complexity). |
| **Deferred to Phase 2 wave** | Blank apparel | 3, 4 | Strong demand signal but commodity pricing, fiber/GSM claims need lab tests, sizing/shrinkage disputes; add once the QA tooling exists. |
| **Deferred** | Bottles & pumps | 7, 8 | Compatibility/leak testing and volumetric freight make landed-cost estimates error-prone before a forwarder process exists. |
| **Deferred (expert review)** | Industrial consumables | 9, 10 | Compatibility failures carry disproportionate buyer cost; needs engineering review per quote. |

Hair is kept as a *parallel* pilot, not the beachhead, because external buyer acquisition is harder (crowded, trust-sensitive) and because a single internal tenant cannot validate willingness to pay.

## 2. Selection criteria (measurable; weights sum to 100)

| # | Criterion | Weight | How measured (Phase 0–1) | Pass threshold for pilot |
|---|---|---|---|---|
| C1 | Founder supplier access | 15 | # of known suppliers willing to give **written** catalog/quote authorization within 30 days | ≥ 5 |
| C2 | Buyer demand reachability | 15 | # of qualified buyer interviews completed in 30 days; # stating they'd pay for the workflow | ≥ 8 interviews; ≥ 3 "would pay" |
| C3 | Spec comparability | 12 | % of 3+ quote sets for one fixed spec that the engine can mark `exact` without manual spec edits | ≥ 70 % |
| C4 | Pre-shipment verifiability | 12 | share of QSR critical attributes checkable visually/with simple tools at PSI | ≥ 80 % |
| C5 | Regulatory/compliance risk | 10 | counsel/compliance screen: none / documentation / licensing | "none" or "documentation only" |
| C6 | Landed-cost determinability | 10 | % of landed lines obtainable from a forwarder quote + duty assumption without specialist | ≥ 80 % |
| C7 | Reorder frequency | 8 | interviewee-reported reorders per year | ≥ 3 |
| C8 | Order value & service margin headroom | 8 | typical order value; whether a service fee of 8–15 % or a $ retainer is plausible (hypothesis) | ≥ US $3k typical order |
| C9 | Time to first confirmed quote | 5 | days from brief to ≥ 3 confirmed comparable quotes in dry run | ≤ 10 business days |
| C10 | Dispute/defect exposure | 5 | historical defect modes severity (interviews) | mostly `major/minor`, rarely `critical` |

### 2.1 Hypothesis scorecard (1–5 per criterion; to be replaced by measured values)

| Family | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | Weighted /5 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Roll labels | 3 | 4 | 5 | 5 | 5 | 5 | 5 | 2 | 4 | 4 | **4.15** |
| Folding cartons | 3 | 4 | 4 | 5 | 5 | 4 | 4 | 3 | 4 | 4 | **3.95** |
| Hair bundles | 5 | 3 | 3 | 3 | 3 | 4 | 4 | 5 | 4 | 3 | **3.78** |
| Heavy cotton tees | 3 | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | 3 | 3.45 |
| Poly performance tees | 2 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 3.10 |
| PET/HDPE bottles | 3 | 3 | 4 | 3 | 4 | 2 | 3 | 3 | 3 | 3 | 3.15 |
| Pump dispensers | 2 | 3 | 4 | 2 | 4 | 2 | 3 | 2 | 3 | 2 | 2.80 |
| Lace wigs | 4 | 3 | 2 | 2 | 3 | 4 | 3 | 5 | 3 | 2 | 3.05 |
| Heat-sealer consumables | 2 | 2 | 3 | 3 | 4 | 4 | 3 | 2 | 2 | 1 | 2.60 |
| Conveyor belts | 2 | 2 | 2 | 2 | 3 | 3 | 2 | 4 | 2 | 1 | 2.30 |

Weighted = Σ(score × weight)/100. Founder should overwrite C1/C2 with actual counts after the 30-day validation sprint.

## 3. Pilot definition of done (per family)

- ≥ 5 suppliers with recorded `source_permissions` (catalog) **or** ≥ 3 suppliers who returned a quote for the same fixed spec.
- ≥ 10 authorized quote documents processed end-to-end with review.
- ≥ 1 complete comparison report exported by a buyer (external for Pilot A; internal tenant acceptable for Pilot B).
- ≥ 1 sample evaluated against a QSR with evidence stored.
- Buyer feedback recorded; willingness-to-pay statement or explicit refusal reason documented.
- Zero compliance holds triggered, or holds correctly blocked.

## 4. Kill / pivot criteria (after 60 days of a pilot)

- < 3 suppliers willing to authorize data in writing → the authorization model is wrong for this family; pause and rework the form or the value exchange.
- < 50 % spec-exact match rate → the attribute schema is too loose or buyers can't specify; invest in brief templates before more suppliers.
- No buyer completes a report → the pain is not where assumed; return to interviews.

## 5. 30-day validation sprint (founder-executed, software-independent)

| Week | Activity | Output recorded in |
|---|---|---|
| 1 | Draft bilingual supplier authorization form (counsel review queued, OQ-06); list 10 label/carton suppliers and 6 hair suppliers already known | `docs/templates/`, `/ops/suppliers` (or spreadsheet until built) |
| 1–2 | 8–10 buyer interviews (brands buying labels/cartons; 3–5 hair vendors beyond own brand) using the script in `docs/templates/BUYER_INTERVIEW.md` (to be created) | interview notes (no personal data beyond business contact) |
| 2–3 | Request catalogs/quotes for **one fixed spec per family** from ≥ 5 suppliers each | authorized documents → future `eval/fixtures` (redacted) |
| 3–4 | Dry-run comparison by hand using `QUOTE_ENGINE_SPEC.md` rules; time it | baseline time-saved metric |
| 4 | Score C1–C10 with real counts; founder decision on Pilot A/B | `DECISIONS.md` ADR-013 |

## 6. Fixed pilot specs (proposed; founder to confirm)

- **Labels:** 50 × 76 mm (2″ × 3″), white BOPP 60 µm, permanent acrylic adhesive, glassine liner, CMYK 4/0, matte lamination, 76 mm core, 500 labels/roll, unwind #2; quantities 5,000 / 10,000 / 25,000.
- **Cartons:** reverse tuck end, 60 × 40 × 120 mm, 350 gsm SBS (C1S), CMYK 4/0 + matte varnish, flat shipped; quantities 1,000 / 3,000 / 10,000.
- **Hair bundles:** 100 g double machine weft, 18″/20″/22″, natural straight, natural color 1B, no chemical processing claimed; quantities 30 / 100 / 300 bundles.

These become the first three `attribute_definitions` seed sets and the first golden-fixture specs.
