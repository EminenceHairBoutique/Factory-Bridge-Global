# FACTORY BRIDGE GLOBAL
## Initial Sourcing Categories, Product Research, and Data Acquisition Specification
**Date:** 2026-11-06  
**Status:** Research-backed hypothesis; requires buyer interviews, supplier permissions, competitive pricing comparisons, freight and compliance validation.  
**Intended users:** Founder, product manager, Claude Project, and Claude Code.

## Executive recommendation
Start with 10 product families across five categories: (1) custom packaging and labels, (2) blank apparel, (3) human hair and salon supplies, (4) personal-care containers/dispensing packaging, and (5) general industrial maintenance consumables. Do **not** build a universal live-search clone of 1688. First validate a managed sourcing workflow with a permissioned supplier price and specification database and customer-specific private quotations.

**Top acquisition wedge:** custom labels and printed cartons for small beauty, apparel, and e-commerce brands. The same buyers often need containers, apparel, and related packaging. Hair provides a second specialized wedge if sourcing/quality evidence and origin tracing are strong. Industrial maintenance supplies are later because compatibility failures carry disproportionate customer costs.

External market evidence: PPAI estimated $27.1B in 2025 US promotional products distributor sales, and research identified apparel as its most frequently reported client-demand category (not SKU-specific demand). FPA reported $42.6B in US flexible packaging industry sales in 2024 (industry scale only, not demand for imported labels). PMMI reported $11.7B US packaging machinery shipment value in 2025 (not a label/consumables measure). US-China goods trade includes substantial plastics, apparel, machinery and furniture volumes. Validate local acquisition and pricing at the SKU level.

## The five categories and 10 initial product families

| Category | Product family | Chinese search terms for manual research | Required comparable specifications | Primary buyer |
|---|---|---|---|---|
| Custom packaging and labels | 1. Custom pressure-sensitive roll labels | 定制卷筒不干胶标签; 防水不干胶标签定制 | Label dimensions, material, adhesive, print colors, finish, roll orientation, core, MOQ, die/tooling | E-commerce brands; contract packagers |
| Custom packaging and labels | 2. Custom folding printed cartons | 定制彩盒包装盒; 折叠彩盒印刷定制 | Finished dimensions, board grade/GSM, finish, inserts, printing, dieline, MOQ, freight carton | Beauty and consumer-product brands |
| Blank apparel | 3. Heavyweight cotton blank T-shirts | 重磅纯棉空白T恤批发; 230克纯棉T恤 | Actual fiber composition, fabric GSM, cut, shrinkage, colors, sizes, labels, MOQ | Clothing brands and print shops |
| Blank apparel | 4. Polyester performance blank shirts | 速干运动空白T恤批发; 涤纶运动T恤 | Fiber composition, GSM, colorfastness, sizing, printing suitability, MOQ | Uniform and promotional firms |
| Human hair and salon | 5. Human-hair bundles/wefts | 真人发发帘批发; 原生发发束 | Source country, traceability, chemical processing, weight, length, texture, grading proof, QC method | Hair vendors and salons |
| Human hair and salon | 6. Lace-front human-hair wigs | 真人发蕾丝假发定制; 高清蕾丝假发 | Lace material, cap construction, density, hair grade and origin, length, shedding, defects, MOQ | Wig brands and salons |
| Containers and dispensing | 7. PET/HDPE cosmetic bottles | 250ml PET化妆品瓶批发; HDPE包装瓶定制 | Resin/material, capacity, neck finish, wall weight, finish, dimensions, artwork, MOQ | Personal-care brands |
| Containers and dispensing | 8. Pump closures and dispenser heads | 乳液泵头批发; 24/410按压泵头 | Neck size, dosage, dip tube length, lock, compatibility, leak testing, MOQ | Contract fillers, personal-care brands |
| Industrial maintenance | 9. Industrial heat-sealer replacement consumables | 工业封口机耗材; 封口机加热条定制 | Machine model, dimensions, materials, wattage/voltage if applicable, compatible standards | Small manufacturing plants |
| Industrial maintenance | 10. Custom light-duty conveyor belts | 工业PVC输送带定制; 轻型输送带 | Width, length, thickness, material, splice, load/speed, operating temperature, food-contact suitability if applicable | Manufacturers and packaging lines |

**Do not represent any search phrase as an existing validated supplier or product listing.** Chinese phrases are starting queries for a human researcher.

## Qualitative first-pass ranking (hypotheses, not statistics)
- 1. Packaging/labels: best initial wedge; easy-to-demonstrate comparison and potentially repeat orders.
- 2. Blank apparel: high demand signal; competitive sourcing; quality and compliance documentation matter.
- 3. Personal-care bottles/closures: good specification match, but leakage/compatibility and volume freight can be costly.
- 4. Human hair: potential differentiation from founder expertise; difficult grading, origin/forced-labor and quality risks.
- 5. Industrial maintenance: useful factory buyer segment but high technical compatibility risk; pilot only after expert review.

## What to exclude from self-service v1
- Pill presses and encapsulating/capsule-filling machines: DEA-regulated machine transaction reporting and potential additional customs requirements; no self-service listing/quotation routing until specialist legal review, verified buyer eligibility, and an approved compliance workflow.
- Medical examination/surgical gloves and purported sterile/medical vials: FDA-device/product rules depend on intended use and claims; no ordinary catalog category until classification and importer responsibilities are reviewed.
- Finished cosmetics, drugs, ingestible empty capsules: potentially significant FDA and quality requirements. Cosmetic products are subject to MoCRA requirements including facility registration/product listing subject to exceptions; packaging alone is different from a finished regulated product.
- Heavy furniture: large freight, damage/returns and complex landed-cost estimates; defer.
- HPLC systems: higher-value technical sourcing, but installation, calibration, after-sales support, warranty, and regulatory end use require specialist approach. Investigate later as managed sourcing only.
- Branded or designer goods where authorization, trademarks, or authenticity cannot be verified.

## Four data classes: never conflate them
1. **Marketplace observation:** an indicative listing viewed by an authorized human or obtained through appropriately licensed API. Source and observed timestamp; do not assume reuse/redistribution rights.
2. **Supplier-authorized published catalog:** manufacturer/authorized seller permits storing and displaying specified SKUs and tiers. Seller identity and document rights recorded.
3. **Private customer RFQ quote:** customer-specific factory response. Visibility only to that customer and authorized sourcing operators unless explicitly otherwise licensed. Includes expiration, terms and specs.
4. **Logistics landed-cost estimate:** computations from documented shipping quotations, validated currency rates, tariff assumptions and known fees. Must not be labeled a factory price.

## 1688 / Taobao / Weidian integration posture
- 1688's legal terms effective October 7, 2026 expressly restrict unauthorized robot/agent access, automated search and scraping, and copying/display/republication of marketplace content. Do not design a bot that simulates logged-in browsing, intercepts private app traffic, bypasses captcha, or relies on seller images without rights. An authorized API/licensed arrangement should be investigated, with explicit scopes and permitted display/storage rights.
- Taobao similarly restricts third-party automation without permission.
- Weidian operates an open developer platform for seller/self-use and service-type apps, subject to specific permissions and review. Explore it only after validating a legal and technical use case.
- The founder may manually search Chinese-language marketplaces to discover factories and then obtain *independent, directly authorized* supplier catalogs and quotations. Do not assume a human's ability to see a price automatically permits republishing platform-owned listing assets.

## Manual sourcing workflow (first 100 records)
1. Choose the above 10 product families, 5–10 plausible factories each.
2. Collect the supplier's **official identity**, source site, business scope, location, buyer contact, and whether they manufacture or trade. Do not label a seller a factory solely because of its listing text.
3. Record marketplace link/reference for internal provenance, indicative range, MOQ, tier thresholds, SKU dimensions, and observed time, subject to applicable rights.
4. Request direct permission for the supplier to supply a structured catalog and indicate precisely which price tiers and photos may be shown to buyers.
5. Request a standardized RFQ for the same fixed specification and quantities from at least three suppliers per product family.
6. Ask for EXW/FOB/other Incoterm, sample pricing, production lead time, payment terms, carton dimensions/weights, origin documentation, quote validity, and customization fees.
7. Store source email/PDF/Excel with secure access; normalize into a structured product family and independent variants and price-tier records.
8. Compare FOB with FOB, EXW with EXW; calculate freight and duties separately when supported by evidence.
9. Record supplier quote response rate, quote recency, extraction accuracy, real savings after freight/tariffs, and end-buyer willingness to pay.
10. Publish only catalog fields/images for which permission exists; private negotiated quotes remain access-controlled.

## Minimal price tier schema
For every offered variant record:
- `supplier_id`, `product_family_id`, `supplier_sku`, `variant_spec_json`, `currency`
- `source_type` = permitted_feed / authorized_supplier_catalog / private_quote / manual_lead_reference
- `source_ref`, `source_observed_at`, `permission_record_id`, `visibility_scope`
- `pricing_basis` = EXW / FOB / FCA / DAP / DDP / unknown (never default unknown to EXW)
- `price_tiers` array/table: `min_qty`, optional `max_qty`, `unit_price`, `unit`, `price_includes`
- `quote_valid_until`, `last_supplier_confirmed_at`, `lead_time_days`, `sample_cost`, `tooling_cost`
- `review_status`, `reviewed_by`, `reviewed_at`, `extraction_source_document_id`
- `shipping_weight`, `carton_size`, `factory_origin`, `quality_documents`, `exceptions`
- created/updated timestamps and audit log

### Illustrative three-tier quote
Supplier A: 100–499 units = ¥10.00; 500–1999 = ¥8.40; 2000+ = ¥7.30, excluding shipping. This is invented example data only. If a buyer orders 600, use ¥8.40 unless the supplier confirms a new custom rate. Always compare quotes for **the same** validated specification, location, quantity, and commercial term. Negotiated quote overrides *only for the entitled customer and validity period*.

## Feature sequence for Claude Code
1. Source registry and legal permission metadata.
2. Supplier identity + product-family normalized spec templates.
3. Private quote upload and bilingual AI structured extraction with mandatory human review.
4. Quantity-tier comparison with deterministic matching and auditability.
5. Secure buyer organization isolation and seller permissions.
6. Supplier CSV/Excel import plus Chinese portal.
7. RFQ invitation and email ingestion with source verification and safe attachment processing.
8. Expiry and freshness alerts.
9. Marketplace connectors only after scope, license, rate limits, and resale/distribution rights are confirmed.

## Pilot success criteria
- ≥3 buyer interviews in one niche that confirm meaningful pain; ideally ≥10 interviews before category-scale investment.
- ≥5 consenting suppliers for one category, ≥3 complete quote sets for consistent specs.
- ≥95% exact extraction accuracy on controlled golden fields **after human review**; independently measure pre-review precision and false-confidence rate.
- Zero cross-tenant quote leaks in RLS integration tests.
- 100% comparison output links to original source document and quote timestamp.
- Show actual relative landed cost only when material required inputs are available; otherwise flag missing information.
- At least 1–3 paid pilot buyers or documented, concrete buying commitments before building large integrations.

## Additional rules for Claude
- Use deliberate classification `catalog_public_with_permission`, `customer_private_quote`, and `internal_market_observation` to prevent accidental publication.
- Don't promise live 1688, Weidian, Taobao or WeChat coverage.
- Don't assume seller storefront = factory; verify legal entity and production location.
- Images are subject to licensing, privacy and IP restrictions.
- No automatic supplier messages or purchase orders without authorized user approval.
- Model outputs must not hallucinate certifications, prices, tariffs, or product origin.
- All restricted/high-risk categories default to hidden/pending expert review.

## Primary research and regulatory references
- PPAI 2025 promo sales: https://www.ppai.org/media-hub/ppai-sales-volume-estimate-promo-reaches-new-height-but-hampered-by-external-volatility/
- PPAI product categories: https://www.ppai.org/media-hub/ppai-research-distributors-are-turning-to-smaller-faster-turn-orders/
- Flexible Packaging Association 2025 report announcement (2024 data): https://www.flexpack.org/news/fpa-publishes-2025-state-of-the-us-flexible-packaging-industry-report
- PMMI 2026 packaging machinery report: https://www.pmmi.org/news/pmmis-2026-state-of-the-industry-report-reveals-a-packaging-machinery-market-driven-by-flexibility-automation-and-new-north-american-opportunities
- Official 1688 legal statement (2026-10-07): https://terms.alicdn.com/legal-agreement/terms/suit_bu1_b2b/suit_bu1_b2b201802011532_36855.html
- 1688 open platform: https://aop.alibaba.com/
- Weidian open platform: https://open.weidian.com/
- FDA medical gloves: https://www.fda.gov/medical-devices/personal-protective-equipment-infection-control/medical-gloves
- FDA cosmetics/MoCRA: https://www.fda.gov/cosmetics/registration-listing-cosmetic-product-facilities-and-products
- DEA regulated tableting/encapsulating machines: https://www.deadiversion.usdoj.gov/21cfr_reports/reg_machines/reg-machines.html
- CBP forced labor guidance: https://content.govdelivery.com/accounts/USDHSCBP/bulletins/41bbeed
- USITC tariff lookup: https://dataweb.usitc.gov/tariff/database

## Prompt for Claude Code
> Update the Factory Bridge Global product roadmap and data architecture using this file as a new research addendum. Do not modify implementation yet. Propose a normalized 10-family catalog schema supporting Chinese-English product taxonomies, structured variants, supplier-specific tier prices, three price-source types, source provenance, licensed display permissions, quote expiry, private customer negotiated pricing, and compliant review workflows. Add a 100-record pilot data-import mapping and golden-file extraction evaluation plan. Treat marketplace automation as unavailable pending explicit authorization. Produce an updated prioritized MVP backlog and report all differences from the original master specification.
