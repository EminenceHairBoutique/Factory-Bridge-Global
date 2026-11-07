# AI PIPELINE AND EVALUATION PLAN

**Status:** Phase 0 design. No prompt, schema or eval set exists yet. All thresholds below are *gates to pass before production use*, not results.

## 1. AI modules (each narrow, schema-constrained, auditable)

| Module | Input | Output schema | Side effects | Human gate |
|---|---|---|---|---|
| `brief_normalizer` | EN/ZH free text + attachments' text | `brief_spec_v1`: attributes keyed by `attribute_definitions`, each tagged `from_input | inferred | missing`, ZH/EN translations, `questions_for_buyer[]` | none (proposal) | Buyer confirms hard attributes |
| `quotation_extractor` | parsed document (text + layout / cells / OCR) | `quote_extraction_v1`: supplier identity hints, product/spec attributes, tiers[], fees[], basis, currency, lead time, validity, payment terms, `anchors` per field, `confidence` per field, `flags[]` | none | Reviewer accepts → canonical |
| `translator` | text + domain glossary + direction | `translation_v1`: text, preserved entities (numbers, units, Incoterms, Pantone codes), `glossary_hits[]` | none | Review for outbound messages; auto for internal display with "machine translation" tag |
| `catalog_matcher` (Phase 2) | brief spec + candidate catalog rows (permission-filtered **before** the call) | `match_v1`: ranked candidates with per-hard-attribute equality verdicts (echo, not decide) | none | Deterministic hard gates run after; AI only orders soft matches |
| `anomaly_flagger` | quote vs spec vs sample vs inspection records (same project only) | `flags_v1`: contradictions with evidence refs | none | Operator triage |
| `message_drafter` | RFQ/clarification context | `draft_message_v1`: body_zh, body_en, open questions list | none | **Approval required to send** |
| `sourcing_copilot` (Phase 3+) | question + permission-filtered retrieval | `answer_v1` with citations to project evidence only | none | n/a (read-only) |

Deterministic code owns: money, FX, tiers, Incoterm comparability, permissions, state transitions, expiry, eligibility, totals.

## 2. Pipeline mechanics

- **Provider adapter** (`packages/ai`): `complete({purpose, templateId, templateVersion, input, schema}) → {output, usage, latency, provider, model}`. Anthropic first (ADR-007); adapter interface allows a second provider for A/B evals.
- **Prompt templates** are versioned files; hash stored in `ai_runs.prompt_version`. Changing a template requires re-running the golden set in CI.
- **Structured output:** request JSON conforming to a JSON Schema generated from the zod schema; validate again server-side; on failure, one repair attempt with the validation error, then `needs_review` with `flags: ["schema_invalid"]`. Never coerce silently.
- **No tools** in extraction/translation/matching prompts. Drafting prompts have no tools either; sending is a separate human action.
- **Untrusted content handling:** see `SECURITY.md` §5.
- **Document chunking:** PDFs ≤ 500 pages; extraction runs per page group with a merge step that is deterministic (dedupe tiers by `(minQty,maxQty,unitPrice)`); long spreadsheets are pre-filtered to rows with numeric price-like cells before prompting.
- **Vision:** image/scan inputs go through OCR first; the image may additionally be sent to a vision-capable model with the OCR text as context; anchors are bounding boxes.
- **Cost controls:** per-org monthly AI budget; per-document token cap; model tiering (small model for translation of short strings, larger for extraction); caching of identical inputs by hash.
- **Logging:** every call → `ai_runs` (model, template version, tokens, cost, latency, status). Every extraction → `ai_extractions` (raw, validated, errors, confidence, anchors, flags).

## 3. Golden evaluation set

### 3.1 Composition (target before first external pilot: ≥ 50 documents; ≥ 100 before any public accuracy claim)

| Slice | Count (min) | Notes |
|---|---|---|
| ZH quotation PDFs (factory letterhead, tables) | 12 | real, authorized, redacted; include 2 with hand-written notes |
| ZH/EN XLSX tier sheets | 10 | various layouts: tiers as columns, as rows, merged cells |
| EN quotation PDFs from trading companies | 8 | |
| WeChat screenshots (user-forwarded) with price text | 8 | mixed ZH, emoji, abbreviations (`含税`, `不含运费`, `起订量`) |
| Photos of printed quotes / handwritten | 4 | OCR stress |
| Email bodies (plain text) | 6 | multi-tier in prose |
| Synthetic adversarial | 10 | prompt injection, contradictory tiers, missing Incoterm, mixed currency, `万`/`k` quantity notations, `元/个` vs `元/千个`, FOB vs 离岸价 wording, validity in lunar/relative dates ("本月底前") |

Each fixture: source file, redaction map, **human-labeled expected JSON** (two independent labelers for 20 % of set; disagreements adjudicated), tags (`locale`, `layout`, `family`, `difficulty`).
Storage: `eval/fixtures/<id>/` with `source.*`, `expected.json`, `meta.json`. Real documents only with written permission; redact names/contacts; never commit unredacted supplier contacts.

### 3.2 Metrics (computed by `eval/run.ts`, reported per slice)

| Metric | Definition | Gate (pre-review, pilot) |
|---|---|---|
| Field precision / recall | per field type (unit_price, min_qty, currency, basis, lead_days, valid_until, moq, fee amounts) | ≥ 0.95 precision on numeric fields; ≥ 0.90 recall |
| Numeric exactness | extracted == expected to the stated precision | ≥ 0.97 on unit_price |
| Tier structure accuracy | set equality of tiers | ≥ 0.90 documents fully correct |
| **Null correctness** | field absent in doc → output null | ≥ 0.98 (invented values are the worst failure) |
| **False-confidence rate** | wrong value with confidence ≥ 0.8 | ≤ 0.02 |
| Hallucination rate | any value not supported by an anchor in the source | ≤ 0.01 |
| Anchor validity | anchor points to text containing the value | ≥ 0.95 |
| Basis correctness | Incoterm enum incl. `unknown` | ≥ 0.95; `unknown` never replaced by a guess |
| Translation term accuracy | glossary terms (材质/克重/起订量/离岸价/含税/模具费/打样费/交期/有效期) | ≥ 0.98 |
| Injection resistance | adversarial set: schema-escaping or action text in output | 0 escapes; ≥ 0.95 flagged |
| Post-review accuracy | after human correction (measures UI + process) | ≥ 0.99 on golden fields |
| Cost / latency | per document p50/p95 | tracked; budget alert only |

Post-review accuracy is measured separately from pre-review so that "95 % after review" is never presented as model accuracy.

### 3.3 Process
- `pnpm eval` runs the full set against the active template versions; CI runs a 15-fixture smoke subset on every PR touching `packages/ai`; full set nightly and on template version bump.
- Regression rule: any gate metric dropping > 2 points vs baseline blocks merge.
- Human corrections in production (`human_corrections`) are reviewed weekly; recurring error classes become new fixtures (with permission) or synthetic equivalents.
- Model/provider changes: run full set on both; record decision in `DECISIONS.md`.

## 4. Bilingual glossary (seed; grows with corrections)

| ZH | EN canonical | Notes |
|---|---|---|
| 起订量 / 最小订购量 | MOQ | |
| 单价 | unit price | check unit: 元/个, 元/千个, 元/kg, 元/米 |
| 含税 / 不含税 | tax included / excluded (VAT) | record as fee note; affects basis comparability |
| 含运费 / 不含运费 | freight included / excluded | |
| 出厂价 | EXW | |
| 离岸价 | FOB | named port required |
| 到岸价 | CIF (sometimes used loosely for CFR) | flag `includes_ambiguous` |
| 模具费 / 版费 / 刀模费 | tooling / plate / die fee | one-time |
| 打样费 | sample fee | |
| 交期 / 生产周期 | lead time | days vs 工作日 (business days) |
| 有效期 / 报价有效至 | validity | relative dates flagged |
| 克重 | GSM | |
| 材质 | material | |
| 统一社会信用代码 | unified social credit code (USCC) | identity check |
| 万 | ×10,000 | quantity parsing |

## 5. Human-in-the-loop UX requirements (for the review tool)

- Side-by-side with click-to-anchor highlighting.
- Confidence shown as bands (high/medium/low) not raw decimals; low → field pre-focused.
- "Not in document" explicit state; reviewer must choose "confirm absent" or enter value with reason.
- Keyboard-first; accept-all disabled when any low-confidence or flagged field remains.
- Every change writes `human_corrections`; accept writes immutable quotation version.

## 6. Open items

OQ-13 second provider for eval; OQ-14 OCR engine choice (Tesseract + chi_sim vs hosted); whether to use vision models directly on scans in Phase 1 (cost vs accuracy — decide with first 20 fixtures).
