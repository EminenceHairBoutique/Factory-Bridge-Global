# QUALITY ASSURANCE — Verification Workflow, Evidence, Badge Semantics

**Status:** Phase 0 design. Operational process is partly manual in Phase 1; software support arrives in Phase 3. No inspection partner is contracted. No guarantee program is approved (OQ-04/OQ-12).

## 1. Principles

1. **Separate, independent states.** Supplier identity, capability, sample and batch are different questions with different evidence. One never implies another.
2. **Badges describe evidence, not reputation.** Every badge resolves to: what was checked, by whom, when, against which checklist version, and until when it is considered current.
3. **Samples are not batches.** An approved sample proves the supplier *can* make it; a passed inspection proves a *sample of a lot* met an acceptance rule with a stated statistical risk. Neither is "zero defects".
4. **Category-specific acceptance criteria.** Every pilot family gets a Quality Specification Record (QSR) template with critical dimensions, materials, tests and defect classes.
5. **Regulated categories are held.** No QA badge substitutes for regulatory compliance; blocked categories don't enter the workflow.

## 2. Supplier qualification state machine (supplier-level)

```
lead_identified → contact_confirmed → legal_identity_reviewed → capabilities_documented
```

| State | Entry evidence (minimum) | Badge text (EN / ZH) |
|---|---|---|
| `lead_identified` | `research_leads` or referral record | none (internal only) |
| `contact_confirmed` | Two-way contact on a business channel; contact record with basis | "Contact confirmed <date>" / "已确认联系 <date>" (internal) |
| `legal_identity_reviewed` | Business license image reviewed; 统一社会信用代码 matched to public registry record (manual lookup), legal name matches bank/invoice name, address corroborated (map/photo/video) | "Identity reviewed <date>" / "企业身份已核验 <date>" |
| `capabilities_documented` | Facility evidence (video call/visit/photos with provenance), product list, equipment list, export experience statement, claimed vs verified entity kind | "Capabilities documented <date> (self-reported items marked)" / "产能资料已记录 <date>" |

Each check is a `supplier_verification_checks` row: `check_type, result, evidence_document_id, reviewed_by, reviewed_at, valid_until`. A state is reached only when its required check set passes; expiry of any required check reverts the badge to "expired — re-review needed", never silently.

**Never shown:** "Verified factory", "Certified supplier", "Gold supplier". **Allowed:** "Identity reviewed (2026-11-20) · Manufacturer status: supplier-claimed, not verified."

## 3. Product-level states (per product variant / per lot)

| State | Scope | Evidence | Badge |
|---|---|---|---|
| `spec_agreed` | variant × buyer | QSR version approved by buyer; supplier acknowledgment | "Spec v3 agreed 2026-12-01" |
| `sample_passed` | variant × buyer | Sample evaluation against QSR; photos/measurements; evaluator; result | "Sample approved for variant X on <date>" / "样品已确认" |
| `golden_sample_sealed` | variant × buyer × supplier | Golden sample agreement signed; sealed sample retained (location noted) | "Golden sample on file" |
| `batch_inspected` | **lot** | Inspection job + result + report document | "Lot L-0007 passed pre-shipment inspection per checklist v2 (AQL 2.5/4.0) on <date>, inspector <org>" / "批次已检验" |
| `batch_failed` / `rework` | lot | as above with findings | "Lot failed inspection — rework in progress" |

A `batch_inspected` badge is **never** displayed at supplier level and **never** carries over to another lot.

## 4. Workflow (buyer-approved order; Phase 3 software, Phase 1 manual)

```
1 Spec        buyer brief → QSR template filled → buyer approves QSR version
2 Sample      pre-production sample requested → received → evaluated vs QSR → pass/fail → counter-sample loop
3 Golden      golden sample agreement (what "like the sample" means; tolerances; photos; retained where)
4 Production  milestones: materials ready → production start → % complete → packed   (dates flagged estimated vs committed)
5 Inspection  checklist from QSR → inspector (third-party or FBG staff) → sampling plan → report with photos
6 Exceptions  defect classification (critical/major/minor) → discrepancy ticket → buyer decision (accept / rework / reject / partial)
7 Remediation responsibility (factory / FBG service error / carrier / buyer spec change / undetermined) → remedy per contract → re-inspection if rework
8 Closure     evidence retained; supplier performance record updated with facts only
```

Exception handling rules: a failed inspection blocks shipment release *recommendation* (FBG cannot physically block; it records the recommendation and the buyer's decision). All decisions are the buyer's unless a managed-service contract says otherwise (OQ-04).

## 5. Sampling inspections — what they can and cannot tell you

Pre-shipment inspections in this trade typically sample per **ISO 2859-1** (equivalent ANSI/ASQ Z1.4) using General Inspection Level II and AQLs such as 0 critical / 2.5 major / 4.0 minor. Illustration (verify against the current standard tables before use): for a lot of 3,000 pieces at Level II, sample size code letter K → **125 pieces inspected**; at AQL 2.5 the lot is *accepted* with up to 7 majors found and rejected at 8.

What that means in plain terms:
- The lot is **accepted** if the sample result is within the acceptance number. It does **not** mean the lot has ≤ 2.5 % defects. A lot with a true 2.5 % major-defect rate is accepted with high probability (~95 %, the "producer's risk" point); a lot with a materially worse rate still has a non-trivial chance of acceptance (the "consumer's risk"). The operating-characteristic curve for the chosen plan should be shown to buyers who ask.
- The inspection covers **the checklist items** at **the moment of inspection** on **the sampled units**. Latent defects (adhesive failure after 6 months, hair shedding after washing, colorfastness after 20 washes) are outside a visual pre-shipment check unless a specific test is in the QSR and performed.
- Cartons not yet packed, units replaced after inspection, or substitution between inspection and loading are risks addressed by container-loading checks and seals, not by the PSI itself.
- Measurement uncertainty: dimensional tolerances in the QSR must exceed gauge resolution.

Therefore the badge reads exactly: "**Passed pre-shipment inspection on <date>: <n> of <N> units sampled per ISO 2859-1 Level II, AQL 0/2.5/4.0, checklist v<k>**", with a link to the report. Never "quality guaranteed".

## 6. Category Quality Specification Records (pilot families)

### 6.1 Custom pressure-sensitive roll labels (定制卷筒不干胶标签)
Critical: face stock (BOPP/PP/PE/paper; white/clear/metallized), thickness (µm), adhesive type (permanent/removable, acrylic/hot-melt, cold/freezer rated), liner (glassine/PET), finished size ±0.5 mm, corner radius, print method (flexo/digital/offset) and colors (CMYK/Pantone refs with ΔE tolerance if spectro available), finish (matte/gloss lamination, varnish), die-cut accuracy (registration ±0.3 mm), roll specs (core ID 76/40 mm, OD max, labels per roll, unwind direction 1–8), splices per roll, gaps (3 mm standard).
Tests: adhesion on target substrate (buyer supplies 5 containers), rub test, water/condensation test for cold-chain, dispensability on buyer's applicator if any.
Defects: critical — wrong artwork/text, missing regulatory text; major — color outside tolerance, misregistration, lifting edges, wrong unwind; minor — small specks outside live area.

### 6.2 Printed folding cartons (定制彩盒)
Critical: board (SBS/C1S/CCNB/kraft), GSM/caliper (e.g., 350 gsm ±5 %), dieline match (buyer dieline version id), finished dimensions ±1 mm, print (CMYK + spot), finish (matte/soft-touch/spot UV/foil), glue type (hot melt/PVA), structure (tuck end/auto-lock/crash-lock), inserts, barcode scan grade (A/B), flat vs pre-glued, master-carton pack count and dimensions.
Tests: fold/crease crack test, scuff test, barcode scan, assembly fit with the buyer's product sample, moisture (if cosmetics), ink odor (if food-adjacent).
Defects: critical — wrong dieline/unreadable barcode; major — cracking on folds, color shift, glue failure; minor — minor scuffs on non-face panels.

### 6.3 Human-hair bundles (真人发发帘)
Critical: hair origin claim (country) with **documentation level** (self-declared / supplier doc / third-party), processing claim (unprocessed / steamed / chemically treated) with test method if claimed, cuticle alignment (observed under magnification), weight per bundle (g ±3 %), length (in/cm measured stretched vs natural for curly), texture code, density, weft construction (machine double/hand-tied), shedding test (brush strokes count), tangle test, odor/chemical smell, color (natural 1B etc. vs dyed), grey percentage.
Tests: strand burn (synthetic detection), wash & blow-dry sample (shedding, texture return), bleach test on a small portion if buyer requires "virgin" claim support.
Defects: critical — synthetic blend, misrepresented processing; major — shedding beyond threshold, weight short, length short; minor — slight odor removable by wash.
Compliance notes: provenance documentation retained for forced-labor due diligence (CBP guidance); "raw/virgin" wording allowed only with buyer-accepted test evidence (see master spec §4).

(Templates for apparel, bottles/pumps, industrial consumables are deferred until those families are selected.)

## 7. Evidence model

Every QA artifact links `document_id` (photos, reports, measurements CSV), `checklist_version`, actor, timestamp, and the entity (supplier / variant / sample / lot). Photos retain original EXIF date where present; inspector-provided reports are stored unaltered with sha256. Buyer-visible evidence excludes supplier contact data unless granted.

## 8. Remediation policy support (not an active promise)

Software models `remediation_cases.responsibility ∈ {factory, fbg_service_error, carrier, buyer_spec_change, undetermined}` and `resolution ∈ {rework, replacement, partial_refund, full_refund, credit, accepted_as_is, escalated}`. Which remedies FBG itself offers, under which contract and insurance, is **OQ-12** and must be approved by the founder with counsel before any public text.

## 9. Inspection partner (not contracted)

Options to evaluate: QIMA, V-Trust, HQTS, Pro QC, SGS/BV/Intertek (premium). Published market rates observed in November 2026 cluster around US $200–350 per man-day all-inclusive in mainland China; verify quotes directly. Who contracts the inspector (buyer vs FBG) is OQ-04.

## 10. Phase 1 manual procedure (until Phase 3 software)

Operators use a shared checklist template (to be created as `docs/templates/QSR_<family>.md` + XLSX) and upload evidence as `documents` with `doc_kind` tags; QA states are recorded in `supplier_verification_checks` and free-form project notes. The Phase 3 tables in `SCHEMA_PLAN.md` §2.9 formalize this.
