# Operations: Audit explorer (Atlas × Obsidian)

Preview: `/design-preview/ops/audit` (`?event=<id>` opens an event). Production serves 404. All data is synthetic (`DEMO DATA — NOT REAL SUPPLIER QUOTATIONS`); IPs appear only as hashes.

Sources: `docs/UX_INFORMATION_ARCHITECTURE.md` §2.4 `/ops/audit` "Audit Explorer (read-only)"; PRD US-A1 / AC-A1.1 (every mutation writes `audit_events`; filter by org / entity / date; append-only); BACKLOG B-26 (explorer UI plus the weekly privileged-access report); ADR-022 and migration 0003 (`audit_events`, `security_events`, `document_access_log`); `docs/SECURITY_PERMISSION_MATRIX.md` row `audit_events` (assigned operators for their projects, compliance and platform admins for all; every platform-admin read is audited); `docs/SECURITY.md` T17 (tampering); OQ-07 (retention, open).

## 1. What the screen is for

Answering "who changed what, when, acting as whom" for any record, without the ability to change the record. The events retell actions from the other preview screens (quotation lifecycle, contact and grant records, compliance decisions, document review, landed-cost snapshots, duty assumptions, message approvals and sends, inspection results, buyer decisions, case replies, research leads, pipeline moves, supplier milestone updates), so the explorer and those screens agree.

## 2. Layout

- **Notice**: read-only, append-only, retention 7 years proposed but undecided (OQ-07), IPs hashed.
- **Header**: events in your scope, entities with chain notes, as-of time; **View as** Operator / Compliance / Admin.
- **Role notice**: operators see assigned projects only; admins are told their reads and exports are audited.
- **Tabs**: Audit events, Security, Document access, each with its count for the role.
- **Filters** (audit events): text (action, entity, actor, request), entity table, organization (entity or actor org), acting-as role, from and to dates (an inverted range shows an error and no rows); chips for an active request or entity filter with Clear.
- **Results**: table at `md`+ (time, actor, acting-as chip, action, entity label and table, organization), cards below `md`; newest first; count and **Prepare CSV export**.
- **Event detail** (right column at `xl`, below otherwise): when, actor and org, acting as, entity, entity org, request, IP hash, before → after hash; the change as field / before / after (restricted values redacted for the role); the entity's hash chain with a state chip and each link's hashes; **Entity history** and **n events in this request** buttons that set the filters.
- **Export ready**: file name, row count, redaction and IP note, the first lines as a preview, **Download CSV**; the export is recorded as an audit event when prepared.
- **Privileged access, last 7 days** (compliance and admin): platform-admin reads and privileged-access security events.
- **Security**: kind chip, time, actor, org, details; operators see "Not in your scope".
- **Document access**: view, download and signed-link rows with user, org and IP hash.

## 3. Rules mirrored (display only)

| Rule | Where | Behaviour |
| --- | --- | --- |
| Scope | `scopedEvents`, `scopedSecurity`, `scopedAccess` | operator: events and access rows of assigned projects only, no security events; compliance and admin: everything |
| Filters | `filterEvents`, `validateDateRange` | entity table, organization (entity or actor), acting-as, date range, request, entity, text; newest first |
| Hash chain | `entityChain` | per entity, each event's before-hash must equal the previous after-hash: consistent / unverifiable (a hash was not recorded, e.g. a backfill) / mismatch (investigate); reads are not links |
| Redaction | `redactDiff` | supplier contact handle, phone and email shown as `[restricted]` to operators (defence in depth; the scope already excludes supplier records) |
| Audited reads | `readEvent` | opening an event as platform admin appends a `read` event acting as `platform_admin` |
| Audited exports | `exportEvent`, `toAuditCsv`, `exportFileName` | every export appends an `export` event; CSV carries hashes, redacted diffs and IP hashes only |
| Weekly report | `privilegedAccess` | last 7 days of platform-admin audit rows and `privileged_access` security events |

An operator's own export is recorded but sits outside the operator's project scope, so it shows to compliance and admins, not to the operator.

## 4. Handoff

`INTEGRATION_HANDOFF.md` H-48: read-only views over `audit_events`, `security_events` and `document_access_log` scoped by RLS as in the matrix; a `project_id` (or ownership path) on audit rows so operator scope can be enforced; server-side redaction of restricted fields in `diff` by role; chain verification as a SQL function over the stored hashes; platform-admin reads and every export written by the server, never by the client; the weekly privileged-access report as a saved query; export as a server job that streams CSV and logs `document_access_log`-style access for the file. The ops navigation entry "Audit" belongs to the shell (UX-03).

## 5. Verification (session 26)

See `DESIGN_02_EXECUTION_REPORT.md` §6x.
