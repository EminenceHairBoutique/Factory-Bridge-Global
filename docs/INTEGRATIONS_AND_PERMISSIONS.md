# INTEGRATIONS AND PERMISSIONS — Data-Rights Matrix

**Status:** Living document. Phase 0 baseline. **No integration is active. No permission has been granted or verified.** Every row below is a design posture, not a statement of rights obtained.
**Rule:** an integration moves from `Blocked`/`Manual` to `Designed` only after this document records the exact permission artifact (agreement, API terms + approved scopes, written supplier consent) and the founder approves.

## 1. Legend

- **Store raw:** keep the original payload/file.
- **Translate/index:** run AI translation, extraction, embeddings, full-text indexing.
- **Internal view:** visible to assigned operators / admins.
- **Originating buyer:** visible to the buyer org that caused the data to exist.
- **Other buyers:** visible to other buyer tenants.
- **Redistribute/benchmark:** reuse in aggregate analytics, marketing, reports to third parties.
- **Images:** store/display product images from the source.
- Status: `Blocked` (do not build), `Manual` (humans may use, software records provenance only), `Allowed-with-permission` (software may store/display per recorded grant), `Designed` (adapter spec exists, not built), `Planned` (phase-gated), `Active` (**none**).

## 2. Matrix

| # | Source | How it reaches us | Store raw | Translate/index | Internal view | Originating buyer | Other buyers | Redistribute/benchmark | Images | Required artifact / legal basis | Freshness semantics | Status | Phase |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | **Manual 1688 / Taobao / Weidian research** (human reads a listing) | Operator types a `research_leads` record: platform, URL/ref, ZH term, observed price range, MOQ, date | **Reference only** — URL + typed observations; **no page copies, no bulk capture** | Translate operator notes only | ✅ | ❌ (not as-is; may inform an RFQ) | ❌ | ❌ | **❌** (listing images are platform/seller IP) | Platform ToS reviewed (1688 legal statement 2026-10-07 restricts automated access and republication); operator policy acknowledging manual-use-only | `observed_at`; "indicative listing"; stale after 30 days (configurable) | **Manual** | 1 |
| S2 | **Automated access to 1688/Taobao/Weidian/Alibaba.com** (scraping, session simulation, browser bots, unofficial plugins) | — | — | — | — | — | — | — | — | Prohibited by platform terms; anti-bot circumvention; no exception | — | **Blocked** | never |
| S3 | **Direct factory catalog upload** (XLSX/CSV/PDF given to us by the supplier) | Operator intake (P1) → supplier portal self-upload (P2) | ✅ | ✅ | ✅ | ✅ per scope | ✅ **only** fields/tiers in `source_permissions.scope` | Only if `scope.benchmark = true` | ✅ if `scope.images = true` and supplier warrants rights | **Written supplier authorization** (bilingual template, Phase 1 deliverable) recorded as `source_permissions` with evidence doc; revocation honored (catalog hidden; transaction records retained) | `source_updated_at` (supplier's date), `last_supplier_confirmed_at`; stale after `valid_until` or 90 days without confirmation | **Allowed-with-permission** | 1 (ops intake) / 2 (portal) |
| S4 | **Quote replies to a specific RFQ** (PDF/XLSX/email body/photo of a quote) | P1: operator uploads what the supplier sent; P2: supplier portal submission or inbound email webhook | ✅ | ✅ | ✅ (assigned) | ✅ | ❌ | ❌ | ✅ within the quote context | Supplier sent it in response to a business request (legitimate business communication); RFQ terms state how quotes are processed; **customer_private_quote** | `quote_date`, `confirmed_at`, `valid_until` (NULL = unconfirmed validity) | **Allowed** (P1 manual) / **Designed** (P2 portal, email) | 1 / 2 |
| S5 | **Buyer-forwarded WeChat content** (buyer or operator screenshots/exports *their own* conversation) | Upload as document, `source_type = buyer_upload` or `operator_import`, `channel = wechat_manual` | ✅ (cropped to the commercial content) | ✅ | ✅ | ✅ | ❌ | ❌ | Only the product photos the supplier sent for that quote | The uploading party is a participant in the conversation; intake UI requires cropping out unrelated personal data; `contact_basis` recorded | As S4 | **Allowed (manual only)** | 1 |
| S6 | **Automated private WeChat message extraction** (reading chat history via unofficial clients, hooks, screen-scraping) | — | — | — | — | — | — | — | — | No authorized API for personal WeChat history; consent and PIPL issues; Tencent terms | — | **Blocked** | never |
| S7 | **WeCom / Feishu / DingTalk official APIs** (enterprise messaging, with the supplier's enterprise consent) | OAuth app, event subscriptions for authorized resources only | Per scope | Per scope | ✅ | ✅ | ❌ | ❌ | Per scope | Enterprise admin consent on supplier side; app review by platform; documented scopes; **does not** grant general chat-history access | Event time | **Planned (evaluate)** | 4+ |
| S8 | **Factory ERP / system API feeds** (supplier pushes price/stock changes) | Signed webhooks or authenticated polling per supplier agreement | ✅ | ✅ | ✅ | ✅ per scope | Per scope | Per scope | Per scope | Supplier integration agreement with scopes, revocation, data-use terms; signature secret per supplier | `source_updated_at` from payload; "supplier reported" never "verified stock" | **Designed** | 4 |
| S9 | **1688 Open Platform API** (官方开放平台) | Registered developer app, approved API scopes, possibly seller authorization | Per license | Per license | ✅ | Per license | Per license | **Per license — assume ❌** | Per license — assume ❌ | Developer agreement; approved scopes; explicit storage/display/redistribution rights; cost/quota; **an API existing ≠ a data license** | Per API; label "indicative listing", `observed_at` | **Blocked pending licensing review** | 4 |
| S10 | **Alibaba.com Open Platform API** | As S9 | As S9 | As S9 | ✅ | As S9 | As S9 | Assume ❌ | Assume ❌ | As S9 | As S9 | **Blocked pending licensing review** | 4 |
| S11 | **Weidian Open Platform** | Developer app; seller/self-use or service apps with review | Per license | Per license | ✅ | Per license | Per license | Assume ❌ | Assume ❌ | Platform review + scopes; use case must be legitimate for the app type | Per API | **Blocked pending licensing review** | 4+ |
| S12 | **Buyer image/document uploads** (reference images, dielines, artwork, own specs) | Buyer uploads into their project | ✅ | ✅ | ✅ (assigned) | ✅ | ❌ | ❌ | ✅ (buyer's own assets; buyer warrants rights) | Pilot agreement clause: buyer grants processing license for sourcing purposes; confidentiality | n/a | **Allowed** | 1 |
| S13 | **Supplier verification documents** (business license, test reports, certificates, photos) | Supplier/operator upload | ✅ | ✅ (OCR for matching) | ✅ | Summarized status only (not the document) unless grant | ❌ | ❌ | Facility photos only with permission | Supplier authorization; "supplier-provided, unverified" until a check row exists | Check `valid_until` | **Allowed-with-permission** | 1 |
| S14 | **FX rates** | Provider API (e.g., ECB/Frankfurter, Open Exchange Rates, or bank) chosen in ADR-010 | ✅ | — | ✅ | ✅ (displayed with source/date) | ✅ | ✅ | — | Provider terms (attribution if required) | `rate_date`; daily | **Designed** | 1 |
| S15 | **Freight quotes** | P1: manual entry from forwarder email (document attached); later: forwarder API | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | — | Forwarder relationship; quote validity | `valid_until` | **Manual** | 1 (manual) / 5 (API) |
| S16 | **Tariff / HTS data** | USITC HTS public data (reference only); classification decided by licensed broker/buyer | ✅ (reference) | — | ✅ | ✅ as "assumption" | ✅ | ✅ | — | Public data; **never AI-classified as fact** | Publication date | **Manual / reference** | 1 |
| S17 | **Inbound email (RFQ replies)** | Resend inbound webhook to `rfq+<token>@…` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Attachments within quote context | Our sending domain; sender verification; attachments go through upload pipeline | Received time ≠ confirmed time | **Designed** | 2 |
| S18 | **Third-party inspection reports** | Inspector uploads / emails | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (report photos) | Inspection service contract naming who may receive the report | Inspection date | **Planned** | 3 |

## 3. Permission record (what we store for every authorized source)

`source_permissions`:
- `supplier_id` / `source_system_id`
- `rights_class`
- `scope`: `{ fields: ["price_tiers","moq","lead_time","specs","images"], images: bool, redistribute: bool, benchmark: bool, buyer_visibility: "platform_buyers" | "named_orgs" | "internal_only" }`
- `evidence_document_id` (signed authorization form, email, or portal consent record with timestamp/IP)
- `granted_at`, `expires_at`, `revoked_at`, `recorded_by`

Revocation behavior: catalog rows become `internal_only` immediately; historical quotations tied to a buyer project remain visible to that buyer (transaction record) but are not re-shared; images are unpublished.

## 4. Bilingual supplier authorization template (Phase 1 deliverable; counsel review required — OQ-06)

Sections: identity of supplier (legal name, USCC), what is shared (catalog fields, price tiers, images), who may see it (platform buyers / named buyers), permitted uses (display, translation, comparison), prohibited uses (resale of data), duration and revocation, confidentiality of negotiated quotes, personal-data minimization for contacts, governing language (ZH with EN translation; precedence to be decided by counsel).

## 5. Connector adapter contract (for S8–S11 when/if approved)

```ts
interface SourceConnector {
  readonly code: string;                     // "supplier_erp:<supplier_id>" | "1688_open" ...
  capabilities(): Promise<{
    discover: boolean; getProduct: boolean; syncCatalog: boolean; createRFQ: boolean;
    permittedUse: string[]; quota: { perMinute: number; perDay: number }; dataTtlHours: number;
    license: { ref: string; expiresAt?: string };
  }>;
  syncCatalog(cursor?: string): Promise<{ records: NormalizedCatalogRecord[]; nextCursor?: string }>;
  getProduct?(sourceProductId: string): Promise<NormalizedCatalogRecord | null>;
  health(): Promise<{ ok: boolean; lastSuccessAt?: string; error?: string }>;
}
```
Every record carries `source_type, provider, permission_scope, source_id, observed_at, source_updated_at, raw_payload_ref, provenance, visibility, expiry`. Ingestion is idempotent (`source_id + source_updated_at`), retried with backoff, dead-lettered, and surfaced in `/ops/integrations`.

## 6. What the UI must say

- S1 data: "Internal research reference — not a supplier offer."
- S3 data: "Supplier catalog price · updated <date> · confirmed <date or 'not confirmed'>."
- S4 data: "Factory-confirmed quote for your request · valid until <date | 'validity unconfirmed'>."
- S9–S11 (if ever): "Indicative marketplace listing · observed <date> · not a binding offer."
- Any blocked connector: shown as **Unavailable**, never simulated.

## 7. Founder decisions required (see OPEN_QUESTIONS)

OQ-03 supplier authorization form approval; OQ-06 counsel review (PIPL, platform terms); OQ-08 whether to pursue 1688/Alibaba.com developer registration in 2027 at all; OQ-13 FX provider.
