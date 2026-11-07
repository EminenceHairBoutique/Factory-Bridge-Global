# QUOTE ENGINE SPEC — Deterministic Comparison and Landed Cost

**Status:** Phase 0 design. Target package: `packages/domain` (pure TypeScript, no I/O, 100 % unit-test coverage required before use in UI). No AI anywhere in this engine.

## 1. Inputs

```ts
type Money = { amount: Decimal; currency: ISO4217 };            // decimal.js, never float
type Qty   = { value: Decimal; unit: UnitCode };                 // 'pc' | 'set' | 'kg' | 'm' | 'roll' | 'carton' ...

interface BriefItem { id; specification: Spec; quantity: Qty; destination: { country: 'US'; postal: string };
                      targetIncoterm?: PriceBasis; requestedAt: Date }
interface Spec      { attributes: Record<AttrCode, AttrValue>; hard: AttrCode[]; version: number; hash: string }

interface Quotation { id; groupId; version; supplierId; specification: Spec; quoteType; status;
                      priceBasis: PriceBasis; incotermPlace?: string; currency; quantityUnit: UnitCode;
                      moq?: Decimal; tiers: Tier[]; fees: Fee[]; productionLeadDays?: number;
                      quoteDate: Date; confirmedAt?: Date; validUntil?: Date | null;
                      packaging?: { pcsPerCarton?: number; cartonCbm?: Decimal; cartonKg?: Decimal } }
interface Tier      { minQty: Decimal; maxQty?: Decimal; unitPrice: Decimal; includes: string[] }
interface Fee       { type: FeeType; amount: Decimal; currency; oneTime: boolean; includedInUnitPrice: boolean }

interface FxRate    { id; base; quote; rate: Decimal; rateDate: Date; source: string }
interface CostInputs{ fx: FxRate[]; freight?: FreightEstimate; duty?: DutyAssumption; brokerage?: Money;
                      insurance?: Money; inlandOrigin?: Money; destDelivery?: Money; asOf: Date }
```

## 2. Pipeline (pure functions, each separately tested)

```
compare(brief, quotations[], inputs) =
  1. filterEligible        → status ∈ {confirmed}; not expired(asOf); compliance clear
  2. matchSpecification    → { exact | soft_mismatch(attrs) | hard_mismatch(attrs) }
  3. selectTier            → tier covering brief.quantity, MOQ check, unit compatibility
  4. groupByComparability  → key = (priceBasis, incotermPlace-normalized, currency?)  [currency handled by FX]
  5. applyFx               → convert to USD using dated rate; retain original
  6. buildLandedCostLines  → one line per component with status sourced|estimated|missing|n/a
  7. rank                  → only within a comparability group, or across groups when every quote's total_status = complete
  8. explain               → machine-readable reasons (UI renders EN/ZH)
```

### 2.1 Eligibility
- `status !== 'confirmed'` → excluded, reason `not_confirmed`.
- `validUntil !== null && validUntil < asOf` → excluded, reason `expired`, display "Expired <date>".
- `validUntil === null` → **included** but flagged `validity_unconfirmed`; UI shows warning; report lists it in exclusions/assumptions.
- `quoteType ∈ {listing, estimate}` → never ranked as an offer; shown separately as reference if visible.

### 2.2 Specification matching
- For each `code ∈ brief.spec.hard`: values must be equal after canonicalization (units to SI, trimmed enums, numeric tolerance per `attribute_definitions.tolerance`, e.g., label width ±0.5 mm when defined). Any difference → `hard_mismatch`, not comparable.
- For codes not in `hard`: differences → `soft_mismatch` list; still comparable but flagged.
- Missing attribute in the quote spec → treated as **unknown**, which for a hard attribute is a `hard_mismatch(reason: 'unknown')`. Unknown is never assumed equal.
- Output includes `matchScore` for display only; ranking never uses the score.

### 2.3 Tier selection and MOQ
```
selectTier(q, qty):
  if q.quantityUnit != qty.unit and no deterministic conversion (pcs↔sets via spec.setSize, rolls↔labels via spec.labelsPerRoll) → error 'unit_incompatible'
  if q.moq && qty < q.moq → result 'below_moq' (not ranked; show MOQ)
  tier = tiers.find(t => qty >= t.minQty && (t.maxQty == null || qty < t.maxQty))   // [min, max)
  if none → 'no_tier_covers_qty' (e.g., qty above top tier with maxQty set, or gap)
```
Tiers are validated on ingestion: ascending `minQty`, non-overlapping, `unitPrice` non-increasing is **not** enforced (suppliers sometimes quote odd curves) but a warning flag `non_monotonic_tiers` is raised for review.
Picking 600 pcs from tiers 100–499 / 500–1999 / 2000+ selects 500–1999. Picking 500 can never select the 2000+ tier (test case).

### 2.4 Comparability by price basis (Incoterms 2020)
Goods-price ranking is allowed only within the same `priceBasis` **and** same named place type:

| Basis | Seller covers up to | Buyer still pays | Comparable with |
|---|---|---|---|
| EXW | Factory door | Inland CN transport, export clearance, origin handling, freight, insurance, import duties/taxes, brokerage, delivery | EXW (same region, as inland cost varies) |
| FCA | Delivered to carrier at named place, export cleared | Origin handling (if not at terminal), freight, insurance, import side, delivery | FCA same place |
| FOB | On board vessel at named port, export cleared | Freight, insurance, import duties/taxes, brokerage, delivery | FOB same port (Shenzhen vs Ningbo ≈ comparable within freight assumptions; flag) |
| CFR / CIF | Freight (and insurance for CIF) to named destination port | Import duties/taxes, destination handling, brokerage, delivery | Same destination port & same term |
| DAP / DPU | Delivered to named place, not import-cleared | Import duties/taxes (DAP), unloading (DAP) | Same destination |
| DDP | Delivered, duties paid | Possibly unloading; verify what "duties paid" includes (tariffs, MPF/HMF, state taxes) | DDP same destination |
| unknown | — | — | **Nothing.** Shown as "Price basis not stated — request confirmation." |

Cross-basis ranking is permitted **only** via landed cost, and only when `total_status = complete` for every quote in the ranking. Otherwise the UI shows groups with the message "Not directly comparable: different trade terms."

### 2.5 FX application
- Convert at `fx_rates` row where `rate_date = inputs.asOf::date` (or latest prior date within 3 days; otherwise `missing_fx` → cannot rank in USD).
- Store `{originalAmount, originalCurrency, rateId, rate, rateDate, source, converted}` for each converted number; never overwrite originals.
- Rounding: carry full precision (≥ 8 dp) through arithmetic; round only at presentation (unit price 4 dp, totals 2 dp) with banker's rounding; document the rule in the report footer.
- CNY quotes stay CNY in the "original" column; USD column labeled "USD @ <rate> (<source>, <date>)".

### 2.6 Landed cost lines (per quotation, for the brief quantity)
Each line: `{ type, status, amount?, currency?, source_ref?, assumption? }`.

| Line type | Derivation | Default status |
|---|---|---|
| `goods` | `selectedTier.unitPrice × qty` (converted) | sourced |
| `tooling` | fees where `type=tooling && !includedInUnitPrice` (one-time) | sourced / n/a |
| `sample` | fee or 0 if not requested | sourced / n/a |
| `packaging_extra` | fee if not included | sourced / n/a |
| `inland_origin` | required if basis = EXW; from freight estimate or manual entry | **missing** unless provided |
| `export_clearance_origin_handling` | required if basis ∈ {EXW}; FCA/FOB include export clearance | missing unless provided |
| `international_freight` | required if basis ∈ {EXW, FCA, FOB}; from `freight_estimates` (status mirrors its `status`) | missing unless provided |
| `insurance` | required if basis ∉ {CIF, DDP}; buyer option; estimated if rate assumption recorded | missing / estimated |
| `duties_taxes` | `goods × duty_assumption.rate_pct` only when `duty_assumptions` row exists with explicit basis; MPF/HMF only if assumption recorded; **AI never fills** | missing unless assumption |
| `brokerage` | manual/estimate | missing unless provided |
| `destination_handling_delivery` | manual/estimate | missing unless provided |

`total_status = complete` iff no required line is `missing`. Totals shown as "Estimated landed total" with status badge; partial totals render as "Partial — excludes: freight, duties" and are **never** ranked.
Double-counting guard: when basis includes a component (e.g., CIF includes freight+insurance), those lines are forced `n/a` even if an estimate exists; the estimate is retained but not summed.

### 2.7 Ranking
- Within a comparability group: sort by `goods + oneTimeFees amortized over qty` (both shown separately as well), ties broken by lead time, then `validUntil` later first. Unit price alone never ranks.
- Across groups: only by landed total when all `complete`.
- Output never says "cheapest"; UI label "Lowest comparable goods cost" / "Lowest estimated landed cost (all inputs present)".

### 2.8 Explanations (codes, rendered bilingually by UI)
`not_confirmed, expired, validity_unconfirmed, hard_mismatch:<attr>, soft_mismatch:<attr>, below_moq, no_tier_covers_qty, unit_incompatible, basis_unknown, basis_differs, missing_fx, missing:<line>, estimated:<line>, non_monotonic_tiers, includes_ambiguous`.

## 3. Worked example (illustrative numbers only — not market data)

Brief: 10,000 custom BOPP roll labels, 50 × 76 mm, 4-color, matte lamination, permanent adhesive, to NJ.
- Supplier A: FOB Shenzhen, CNY, tiers 5,000–9,999 @ 0.26, 10,000–49,999 @ 0.21; tooling ¥300 one-time; valid until 2026-12-15.
- Supplier B: EXW Dongguan, USD, tiers 10,000+ @ 0.027; tooling included; validity not stated.
- Supplier C: FOB Ningbo, USD, 2,000+ @ 0.031, but material = paper (hard attribute mismatch).

Engine result:
- C → `hard_mismatch:material` group "Not comparable — spec differs (material: paper ≠ BOPP)".
- A → tier 10,000–49,999 @ ¥0.21 → goods ¥2,100 → USD @ rate row (source, date) e.g. 7.20 → $291.67 (display only); tooling ¥300 → $41.67; basis FOB.
- B → tier 10,000+ @ $0.027 → goods $270; tooling n/a; basis EXW; flag `validity_unconfirmed`.
- A and B are in **different groups**. No cross ranking until `inland_origin`, `export_clearance`, `international_freight` are provided for B and `international_freight` for A. With those as `estimated` from a forwarder email, the landed table ranks them and labels every estimated line.

## 4. Test matrix (Vitest, `packages/domain/__tests__/quote-engine/*`)

| ID | Case | Expected |
|---|---|---|
| QE-01 | qty 500 with tiers 100/500/2000 | selects 500–1999 |
| QE-02 | qty 500, MOQ 1000 | `below_moq` |
| QE-03 | qty 10,000, top tier `2000+` (no max) | selects 2000+ |
| QE-04 | overlapping tiers at ingestion | validation error |
| QE-05 | EXW vs FOB without landed inputs | separate groups, no cross rank |
| QE-06 | CIF quote + freight estimate present | freight line `n/a`, not summed |
| QE-07 | validUntil null | included + `validity_unconfirmed` |
| QE-08 | validUntil < asOf | excluded `expired` |
| QE-09 | hard attr unknown in quote | `hard_mismatch:<attr>` |
| QE-10 | FX rate missing for date | `missing_fx`; no USD ranking; CNY still shown |
| QE-11 | duty assumption absent | `duties_taxes: missing`; total partial |
| QE-12 | 0.0123 × 1,000,000 precision | exact Decimal; no float drift |
| QE-13 | rolls↔labels conversion via spec | converts when `labelsPerRoll` present; else `unit_incompatible` |
| QE-14 | non-monotonic tiers | accepted with `non_monotonic_tiers` flag |
| QE-15 | price basis `unknown` | group "basis not stated"; never ranked |

Property-based tests (fast-check): tier selection total order; sum of lines equals total when complete; converting and converting back within 1e-8.

## 5. Report content contract (PDF/CSV)

Header: brief id/version, quantity, destination, generated at, engine version, FX rows used.
Per quote: supplier display name (or anonymized code per OQ-05), quote version, source document ref, `confirmed_at`, `valid_until`, basis + place, original currency/price, selected tier, fees, each landed line with status, total with status, flags, spec differences.
Footer: assumptions list, exclusions list, rounding rule, "Estimates are not customs or legal advice", "Supplier-provided data unless marked verified".
CSV: one row per (quote, line) plus a summary sheet; never merged cells; UTF-8 with BOM for Excel ZH compatibility.
