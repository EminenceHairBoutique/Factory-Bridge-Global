# Project Overview — Prototyped Screen

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #10). Route `/design-preview/buyer/project` (dev only; 404 in production builds). Implements the RecordPage template (IA §3) for `/app/projects/[id]` as specified in `docs/design/SCREEN_INVENTORY_AND_SPECS.md` §3.1, using the labels demo project. Synthetic data only.

## 1. Job

Answer, for one project, "where is it, who is doing what, what needs me, and where did each number and document come from" without leaving the page, and make every side effect's approval chain visible.

## 2. Layout

- **Header:** project name, family, quantity, destination; chips for brief version with confirmation date, assigned operator, as-of date; actions Upload a quote · Open comparison.
- **Stage strip:** the seven stages with the current one marked and "stage n of 7".
- **Tabs:** Overview · Brief · Supplier options (count) · Compare · Documents (count) · Messages (count of items awaiting you) · Reports (count) · Activity. Tabs scroll horizontally on phones.
- **Evidence drawer** (xl right rail; hidden below): project record facts (id, organization, operator, assigned and updated dates), brief versions v1–v3 with timestamps and authors, and the approval gates on the project (RFQ approved, sample approved, clarification awaiting you, selection and handoff not started).

## 3. Tabs

| Tab | Content | Interaction |
|---|---|---|
| Overview | **Next action** (raised card with the reason: eligible vs not-ranked counts, expiring quote, missing landed inputs) · **Status timeline** (brief created, brief confirmed v3, supplier options identified with "outbound RFQ approved by you", quotes received and reviewed, comparison ready = current, sample requested and order handoff pending with what unlocks them; each done step shows timestamp and actor) · **Quotes at a glance** (per supplier: basis and currency; valid-until chip, validity unconfirmed, or the exclusion reason from the same display helper the comparison uses) · **Open items** | buttons jump to Messages / Documents; link to the comparison |
| Brief | confirmed v3: hard attributes, soft attributes (each with the Chinese label and value), quantity and terms | link to the brief-confirmation prototype |
| Supplier options | six suppliers with basis, currency, MOQ, source type and evidence badges (popover: what / who / when / until); "No verification record yet" where none | evidence popovers |
| Compare | the comparability groups with their members, the "cross-group ranking unavailable" reason, link to the comparison | |
| Documents | pipeline status per document (uploaded → scanning → parsed → extracted → in review → accepted) with source, owner, date, version and the linked record; filter by kind; "Open review" for in-review items; download labelled as a server-issued signed link | filter chips |
| Messages | threads with approval chain **You → Operator → Sent via platform**; "Approve draft" moves the chain forward and the status to "Awaiting operator approval"; sample approval and expiry notices shown as records | approve draft |
| Reports | report with generation time, brief version, FX date, quotes ranked, assumptions and exclusions; "Stale: a quote was confirmed after generation"; download disabled pending B-23 | |
| Activity | audit-derived list with `acting_as` label (user / operator / system / platform admin), actor, action, entity | |

## 4. Rules shown on screen

Human approval before any outbound message, supplier selection or handoff (CLAUDE.md §4); evidence badges only from check records; contacts hidden without a disclosure grant; documents never "verified" by upload; reports carry assumptions and exclusions; audit events name who acted and as what.

## 5. Verified in the browser

All eight tabs render their panels; "Approve draft" advances the chain (You done with date, Operator waiting) and the Overview "Approve 1 draft" button disappears; no console errors; no horizontal overflow at 320, 375 and 768 px in Obsidian.

## 6. Contract the UI assumes (handoff H-29)

Project DTO with stage, assignment (operator, assigned_at), brief versions, timeline events derived from `audit_events` (actor, acting_as, at, entity), documents with `document_status`, source and linked record, message threads with an approval chain (`approvals[{ role, state, at }]`) and `outbound_log` once sent, reports with brief version, FX date, assumptions and exclusions plus a staleness flag computed from later quote confirmations.

## 7. Not built

Upload, download and report generation; message wording editor; project list with saved views (B-15); operator-side project view.
