# LAUNCH ECONOMICS — Planning Assumptions

**Status:** Phase 0 planning assumptions. Vendor list prices were checked against public pricing pages/articles on 2026-11-07 and **must be re-verified at purchase time**; nothing here is a quote or a commitment. No paid account may be created without founder authorization. AI per-document costs are formulas with placeholder ranges, not measured results.

## 1. Cost structure: fixed vs variable, and who pays

| Item | Type | Planning figure (USD) | Driver | Who pays | Notes |
|---|---|---|---|---|---|
| **Software platform** | | | | | |
| Supabase Pro (2 projects: dev, prod) | Fixed | $25/mo plan + compute (~$10/project, first project credited) ≈ **$35–60/mo**; PITR add-on before pilots (verify price) | projects, compute size | FBG | Spend cap ON. Storage overage $0.125/GB-mo past 8 GB DB; file storage per plan limits. |
| Vercel Pro | Fixed | **$20/mo** (1 deploying seat; viewers free) + usage beyond $20 credit | seats, traffic | FBG | Expect ≤ $40/mo at pilot traffic. |
| Worker host (Railway / Fly.io / Render) | Fixed→variable | **$10–30/mo** for one small always-on service | CPU/RAM, scan sidecar | FBG | Decision ADR-006. ClamAV sidecar adds memory (~1–2 GB) — may push to $20–40. |
| Resend (email) | Fixed | $0 (free tier) → **$20/mo** at pilot volume; inbound add-on verify | emails/mo | FBG | Domain verification required. |
| Sentry | Fixed | $0 (dev) → ~$26/mo team | events | FBG | |
| Domain + DNS | Fixed | ~$15–40/yr | — | FBG | Pending OQ-02 (brand). |
| GitHub | Fixed | $0 (free org) → $4/user/mo Team if needed | users | FBG | |
| **Usage-based AI** | Variable | **$0.05–0.60 per document** (planning range; depends on pages, images, model tier) | documents processed, retries | FBG (absorbed into price/fee) | Formula §2. Cap per org/month. |
| OCR (if hosted) | Variable | $0–0.01/page | pages | FBG | Tesseract self-hosted = $0 + CPU. |
| FX data provider | Fixed | $0 (ECB-based free sources) → $12–50/mo commercial | calls | FBG | ADR-010. |
| **Storage** | Variable | ~$0.02–0.03/GB-mo + egress | documents, images, reports | FBG | 1,000 quote docs ≈ 2–5 GB → negligible. |
| **Inspection partner** | Variable, pass-through | **$200–350 per man-day** mainland China (observed market range; premium firms higher; travel extra beyond ~60 km) | lots inspected | **Buyer** (pass-through at cost or with disclosed coordination fee) | Who contracts the inspector = OQ-04. Lab tests (fiber, adhesion) extra: $50–300/test, verify. |
| **Samples & courier** | Variable, pass-through | Sample fee $20–200 + DHL/FedEx CN→US $40–120 per shipment (planning) | samples | **Buyer** (reimbursable) | Golden sample duplicates ×2. |
| **Shipping quotes (freight)** | Variable | $0 to obtain from forwarders; API (Freightos etc.) later: verify | shipments | **Buyer** pays freight; FBG pays any API | Phase 1 manual. |
| **Payment processing (Stripe)** | Variable | 2.9 % + $0.30 card; ~0.8 % ACH capped (verify) | invoices | FBG | Phase 5; pilot invoices manual/ACH. |
| **Customer acquisition** | Mostly founder time | $0–500/mo paid (LinkedIn, niche communities, trade groups); content | leads | FBG | No paid ads until value prop validated. |
| **Customer support** | Founder time → variable | 0 cash; later part-time bilingual operator $25–40/hr contract (planning) | active projects | FBG (priced into fee) | Track minutes per project. |
| **Legal / compliance** | Fixed, lumpy | $2k–8k one-time (entity verification, pilot agreement, supplier authorization, privacy policy, PIPL opinion) | — | FBG | OQ-02, OQ-06, OQ-09. Range is a planning guess; obtain quotes. |
| **Insurance** | Fixed | E&O / general liability: obtain quotes before any managed-service contract | — | FBG | OQ-12. |
| **Accounting / banking** | Fixed | $50–150/mo | — | FBG | |

**Pilot-phase monthly cash burn (software only), planning estimate:** **$120–260/mo** before AI usage and legal; AI at 100 documents/month adds **$5–60**. Legal is the dominant pre-launch cash item.

## 2. AI cost formula (fill with the provider's current price list; never hardcode numbers in docs)

```
cost_per_doc = Σ over calls [ (input_tokens × price_in) + (output_tokens × price_out) ]
typical extraction: 1 call/page-group × (3k–12k input tokens incl. layout text, 0.8k–2k output tokens)
typical translation: 0.3k–2k tokens per field group
retry/repair: +15 % allowance
vision on scans: +1 image input per page (price per image per provider)
```
Measure on the first 50 golden fixtures (`eval/run.ts` reports cost per doc) and replace the planning range with the measured p50/p95. Current provider price list: https://docs.claude.com (verify at implementation).

## 3. Revenue hypotheses to test (not prices)

| Model | Hypothesis | Who pays | Validation |
|---|---|---|---|
| Software workspace subscription | $99–299 / buyer org / month with RFQ quotas (spec §15/§16 ranges) | Buyer | ≥ 3 pilots convert after free period |
| Per-sourcing-request service fee | $250–750 per completed comparison with ≥ 3 confirmed quotes | Buyer | Buyers choose it over DIY |
| Managed sourcing fee | 5–12 % of FOB goods value or retainer; disclosed; no hidden supplier commissions | Buyer | Margin after operator time + QA coordination |
| QA coordination fee | Inspection at cost + fixed coordination fee | Buyer | Take-rate acceptable |
| Supplier-side fees | **None in pilots** (neutrality); evaluate later with disclosure | Supplier | — |

Unit economics to track per project: operator minutes, AI cost, inspection pass-through, support minutes, gross contribution.

## 4. Break-even sketch (illustrative)

If fixed software + tooling ≈ $250/mo and legal amortized over 12 months ≈ $400/mo, fixed ≈ $650/mo. At a $199/mo subscription plus one $400 service fee per customer-month, **~2–3 paying pilot customers** cover fixed costs excluding founder time. Founder time is the real cost; track it.

## 5. Budget gates (founder approval required to cross)

| Gate | Trigger | Approval |
|---|---|---|
| G1 | Create any paid account (Supabase Pro, Vercel Pro, worker host, Resend paid, Sentry paid) | Founder, per account |
| G2 | AI spend > $100/mo | Founder |
| G3 | Legal engagement > $2,000 | Founder |
| G4 | First inspection booking | Founder + buyer written authorization |
| G5 | Any supplier commission/placement arrangement | Founder + disclosure policy |
