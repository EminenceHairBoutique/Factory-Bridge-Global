# SECURITY PERMISSION MATRIX

**Status:** Phase 0.5 design (ADR-020). Normative for `packages/domain/policy` (server layer) and for RLS policies in `supabase/migrations/`. Both layers implement the same matrix; a test enumerates it (B-07). Default is **deny**. Labels (`visibility_scope`, `rights_class`) describe data; they never grant access by themselves — only an **active grant** or **ownership/assignment** does.

## 1. Subjects

| Code | Subject | How established |
|---|---|---|
| `B.owner` `B.admin` `B.member` `B.viewer` | Buyer org roles | active `memberships` row, org `org_type='buyer'` |
| `S.owner` `S.admin` `S.member` | Supplier org roles | active `memberships` row, org `org_type='supplier'` |
| `I.op+` | Internal operator **assigned** to the project | `memberships` in internal org with role `operator`/`compliance_reviewer`/`platform_admin` **and** `project_assignments` row |
| `I.op−` | Internal operator **not** assigned | internal membership only |
| `I.comp` | Compliance reviewer | internal membership, role `compliance_reviewer` |
| `I.admin` | Platform admin | internal membership, role `platform_admin`; every read is audited |
| `SYS` | Service role (worker / privileged server module) | `BYPASSRLS` — **not** subject to RLS; must call narrow `SECURITY DEFINER` functions that re-check authorization and audit with `acting_as='system'` |

Membership is checked **live** on every request (`app.is_member`), never from a cached JWT claim. Removing a membership or changing a role takes effect at the next statement; the server additionally revokes sessions on role change.

## 2. Resources and actions

Actions: **R** read, **C** create, **U** update (non-ownership fields), **X** export / signed-URL issuance, **SH** share (create grant), **RV** revoke grant, **AC** accept/reject (review or quote lifecycle), **AU** read audit trail, **T** lifecycle transition.

| Resource | B.owner/admin | B.member | B.viewer | S.owner/admin | S.member | I.op+ | I.op− | I.comp | I.admin | SYS |
|---|---|---|---|---|---|---|---|---|---|---|
| Own org settings, members, invites | R C U | R | R | R C U (own org) | R | — | — | — | R U (audited) | via priv. fn |
| Sourcing project / brief (buyer-owned) | R C U X | R C U X | R | — | — | R U X | — | R (hold review only) | R (audited) | job reads |
| Buyer-uploaded documents (`buyer_uploaded_private`) | R C X | R C X | R | — | — | R X | — | — | R (audited) | parse/scan |
| Operator-imported documents (`internal_only` until permission) | — | — | — | — | — | R C X | R C (own imports) | R | R | parse/scan |
| Research leads (`internal_market_observation`) | — | — | — | — | — | R C U | R C U | R | R | — |
| Supplier profile (public fields via `supplier_public_profile_v`) | R | R | R | R U (own) | R (own) | R C U | R | R | R | — |
| **Supplier contacts (restricted)** | only rows with active `contact_disclosure_grants` | same | — | R U (own org) | R (own org) | R C U | **—** | R | R (audited) | — |
| Supplier verification checks | summarized status only | same | same | R (own) | R (own) | R C U | R | R C U | R C U | — |
| Supplier-authorized catalog (`catalog_public_with_permission`) | R **iff** `catalog_grant_active(supplier, my_org, field)` | same | same | R C U (own) | R (own) | R C U | R | R | R | import |
| `source_permissions` (grants) | R (grants naming my org) | same | — | R (own) SH RV (own, `owner/admin`) | R | R C(record) RV (with evidence) | R | R | R | — |
| Negotiated quotation (`customer_private_quote`, buyer-owned) | R X | R X | R | R (own quotes only) | R (own) | R X T | — | — | R (audited) | expiry job |
| `quote_visibility_grants` | R (grants to my org) | same | same | — | — | C RV | — | — | R | — |
| Quotation lifecycle (`T`) — confirm/supersede/withdraw | AC (confirm from review) | AC | — | withdraw own | — | AC T | — | — | T (audited) | expire |
| Review tasks / extractions | R AC (own org) | R AC | R | — | — | R AC | — | — | R | create |
| Comparison snapshots / landed-cost scenarios / reports | R C X | R C X | R X | — | — | R C X | — | — | R | render |
| FX rates, taxonomy, attribute definitions | R | R | R | R | R | R | R | R | R U | write FX |
| `audit_events` | AU (own org, owner/admin only) | — | — | AU (own org, owner/admin) | — | AU (assigned projects) | — | AU | AU | write only via fn |
| `security_events` | — | — | — | — | — | — | — | R | R | write |
| `ai_runs` (AI call ledger, append-only) | R (own org) | — | — | R (own org) | — | — | — | R | R | write only via `app.record_ai_run` |
| `ai_budgets` (monthly AI cap) | R (own org) | — | — | R (own org) | — | — | — | — | R U (via `app.set_ai_budget`, audited) | read + set |
| Compliance holds | — | — | — | — | — | R | R | R C U | R C U | — |

Everything not listed is denied. "—" means no access, including through joins, RPCs, exports, search indexes, embeddings, AI prompts and cached snapshots: every such path is built from a query that is itself RLS-filtered for the acting user.

## 3. Grant evaluation rules (the part labels never do)

### 3.1 Supplier catalog → buyers (`source_permissions`)
A catalog row (`quotations.quote_type='supplier_catalog'` or future `catalog_listings`) is readable by a buyer-org member **iff** there exists a `source_permissions` row where:
`supplier_id` matches **and** `revoked_at is null` **and** (`expires_at is null or expires_at > now()`) **and** `scope.buyer_visibility in ('platform_buyers')` **or** (`'named_orgs'` and `viewer_org = any(scope.named_org_ids)`) **and** the requested field ∈ `scope.fields`.
Field gating is enforced by **views** (`catalog_tiers_v` exposes `price_tiers` only when the grant includes it) and by the DTO layer; images only when `scope.images`; benchmark/analytics only when `scope.benchmark` (Phase 5, k ≥ 5 suppliers).
`visibility_scope='platform_buyers'` on the row is a **declared intent**, checked by a trigger to be *consistent* with an active grant at write time, but **never consulted by read policies**.

### 3.2 Buyer-owned negotiated quotations
Readable by: members of `quotations.buyer_org_id`; assigned operators for `brief_item_project(brief_item_id)`; members of the owning supplier org (their own quote); any org holding an unexpired, unrevoked `quote_visibility_grants` row for **that quotation version**. Grants are attached to `(quotation_id, grantee_org_id)` — never to a supplier or a nullable link — and are created only by `I.op+` with a `reason`, audited.

### 3.3 Contacts
`supplier_contacts` readable by internal roles with assignment-or-blanket as in §2 (note `I.op−` has **no** access), by the supplier's own org, and by a buyer org only through an active `contact_disclosure_grants` row. Buyer-facing views, DTOs, PDF/CSV/XLSX exporters and AI prompt builders read from `supplier_public_profile_v`, which has no contact columns — a policy regression cannot surface them through the standard path.

### 3.4 Revocation policy
| Data | On revocation / expiry |
|---|---|
| Catalog rows under a revoked `source_permissions` | immediately invisible to buyers (policy re-evaluates the grant each read); images unpublished; search/embedding rows for those items deleted by a job |
| Negotiated quotations already in a buyer's project (`customer_private_quote`) | **retained and visible to that buyer** — they are the buyer's transaction record; the supplier cannot revoke a quote it issued, only `withdraw` it going forward (lifecycle), which marks it ineligible for new comparisons but leaves history intact |
| `quote_visibility_grants` revoked | grantee loses access immediately; existing exported reports are not recalled (they are the grantee's records); the revocation is audited |
| `contact_disclosure_grants` revoked | contact disappears from buyer views; prior exports are not recalled |

### 3.5 Ownership immutability
`org_id`, `buyer_org_id`, `supplier_id`, `project_id`, `brief_id`, `grantee_org_id`, `supplier_contact_id` and the whole `quotations` payload cannot be changed by UPDATE/UPSERT: `app.prevent_owner_change` triggers raise, independent of RLS. Policies therefore never need the fragile "compare the row to itself" `WITH CHECK`. Moving data between tenants is not a supported operation; if ever needed it is a privileged, audited, two-step copy.

## 4. Service role and BYPASSRLS — stated precisely

Postgres `FORCE ROW LEVEL SECURITY` applies policies to the table **owner**; it does **not** constrain roles with `BYPASSRLS`. Supabase's `service_role` has `BYPASSRLS`. Consequences:
- RLS tests must run as `authenticated` with `request.jwt.claim.sub` set — a test that passes under `service_role` proves nothing.
- Every service-role write goes through a `SECURITY DEFINER` function in `app` that (a) takes explicit, validated arguments, (b) re-checks the business authorization in SQL, (c) writes an audit event with `acting_as='system'` and the verified actor, and (d) has `EXECUTE` granted only to `service_role`. Lint forbids importing the service-role client elsewhere (`eslint.config.mjs`).
- The worker never runs free-form SQL as service role; it calls those functions or RLS-filtered queries with a user JWT where a user context exists.

## 5. Storage

Buckets are private. Object paths are `<org_id>/<document_id>/<sha-prefix>-<name>`. `storage.objects` policies: `insert` into `quarantine` requires `app.is_member((storage.foldername(name))[1]::uuid)`; `select` on `documents`/`reports`/`supplier-evidence` requires the same membership **or** `app.is_assigned_to_project(app.document_project(id))` (helper added with 0006 — maps document → project when attached). Signed URLs are minted only by the server after the same policy check and are logged in `document_access_log` with expiry ≤ 15 minutes. Tests: guessing a valid path as another tenant yields 403; an expired signed URL yields 400/403; revocation of a grant stops new URL issuance immediately.

## 6. Audit of privileged access

`I.admin` reads of tenant data and every `SYS` call are audited with `acting_as ∈ {'platform_admin','system'}`. Weekly report job (Phase 1 manual query) lists admin reads per org; anomalies alert. `audit_events` has no UPDATE/DELETE grants for any role; retention per OQ-07; legal erasure is a documented superuser procedure that records a tombstone.

## 7. Test obligations derived from this matrix (B-07 harness)

For each row of §2 with a "—": a negative test. For each grant type: active → allowed, expired → denied, revoked → denied, wrong org → denied, wrong field → denied. For ownership columns: UPDATE attempt raises. For `I.op−`: project, documents, quotes and contacts all denied. For role removal: the same session's next statement is denied. Coverage guard: a `public` table without an entry in the harness table list fails CI.
