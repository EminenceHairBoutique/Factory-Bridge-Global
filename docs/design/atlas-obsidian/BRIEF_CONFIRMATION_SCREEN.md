# Brief Confirmation — Prototyped Screen

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #10). Route `/design-preview/buyer/brief` (dev only; 404 in production builds). Implements the screen specified in `docs/design/SCREEN_INVENTORY_AND_SPECS.md` §3.2 for the hair-bundles demo project, consistent with the dashboard's "Confirm 3 inferred specification values" action. Synthetic data only.

## 1. Job

Turn the buyer's raw words into a confirmed, bilingual specification without letting anything the AI inferred count until the buyer says so (PRD AC-B1.2), and keep every version (AC-B1.3).

## 2. Layout

- **xl and up:** left column (sticky) with *Your input (v1)* and *Versions*; right column with the proposal grouped into Product · Specification · Quantity and destination · Terms and quality. Each field is a three-cell row: **field and where it came from** (label, "required for matching" tag, provenance badge, the verbatim snippet or the reasoning) · **AI proposal (v2) · 中文** (English value and Chinese label with value) · **Your decision (v3)**.
- **md–lg:** the same three cells per row, raw input and versions stacked above.
- **phone:** single column; each row stacks its three cells; raw input panel first.

Hovering or focusing a row highlights the words in the raw input that the value came from (`<mark>`, action-tinted when active).

## 3. Provenance and decisions

| Provenance | Initial decision state | Controls |
|---|---|---|
| from input | confirmed ("Confirmed from your input") | Edit |
| inferred | pending ("Needs your decision") | Accept · Edit · Not sure (hard) |
| missing, hard | pending ("Needed for matching") | Provide · Not sure |
| missing, optional | pending ("Optional, not stated") | Provide · Skip |

Edits record the previous value ("was …"). Accepting records "Accepted by you". "Not sure" on a required attribute is allowed but shows "Not sure — an operator will ask you" and blocks supplier options after confirmation; the request button names the unresolved attributes in its tooltip.

## 4. Versions

v1 raw input (timestamp, buyer) · v2 AI proposal (timestamp, `brief_normalizer v1.0.0`, prompt hash, counts) · v3 created on **Confirm brief** with timestamp, buyer, and a note of how many values were edited, accepted or left "Not sure". Editing anything after confirmation turns the header into "Draft v4 — changes since v3"; the confirmed version is never overwritten.

## 5. Verified in the browser

Nine snippets highlighted; progress "9 of 15 values decided" on load and the confirm action disabled; accepting, marking "Not sure", skipping and providing a value brought it to 15 of 15 and enabled confirm; confirming added "Confirmed by you" to the timeline and showed the v3 notice; "Request supplier options" stayed disabled with the tooltip naming "Weight per bundle"; "Provide a value" after confirmation reopens a draft. No console errors; no horizontal overflow at 320 and 375 px in Obsidian.

## 6. Contract the UI assumes (handoff H-27)

`brief_spec_v1` output per field: `key`, `label` (en), `label_zh`, `group`, `hard`, `value` (en, canonical units), `value_zh`, `provenance ∈ {from_input, inferred, missing}`, `snippet` (verbatim substring of the raw input, for from_input and some inferred), `reasoning` (short, for inferred and missing), `options` (allowed values from `attribute_definitions`). Confirmation writes a new brief version with per-field `{ value, source ∈ {from_input, accepted, edited, unknown, skipped}, previous }`.

## 7. Not built

Re-run structuring (inert), attachment viewer, operator-side view of "Not sure" questions (B-24), real version storage.
