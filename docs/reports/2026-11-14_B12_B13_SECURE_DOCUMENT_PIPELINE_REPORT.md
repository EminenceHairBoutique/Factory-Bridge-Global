# Session report — 2026-11-14 (B-13 malware scanning + B-12 isolated parsing)

**Phase:** 1 | **Slice:** quarantined upload → scan → sandboxed parse → reviewable source records | **Branch:** `eng/b12-b13-document-processing` | **PR:** draft to `main`, no auto-merge

## Summary

The `fbg_documents` queue now has a real handler. Given a document row and its object in quarantine, the worker validates the file, scans it with ClamAV, parses it in a restricted child process, promotes the scanned bytes and writes `document_pages` / `document_cells` with page and cell anchors. It works end to end on a local stack with real Postgres, real Storage and real ClamAV.

It is **not** ready for a hosted environment, and the code refuses to run there. Three things stand between this and real customer documents:

1. **The parser sandbox is process-level isolation, not an operating-system sandbox.** Document processing can only be switched on in local development against a local stack (§3, ADR-045).
2. **The scanner choice is still yours.** ClamAV is implemented and tested because it is free and local; ADR-043 is proposed, not accepted (§8).
3. **Nothing produces jobs yet.** The upload path belongs to the B-05 follow-up; §7 is the contract for it.

No AI model was called, no extraction job is enqueued, nothing was deployed, no paid service was used, and no repository setting was changed.

| | |
|---|---|
| **Implemented** | Staged queue handlers (prepare with no transaction open, commit in the success transaction, post-commit housekeeping). Upload validation: job contract, storage-path binding, MIME ↔ extension ↔ magic bytes, polyglot check, streamed 25 MB cap, sha256. Scanner interface + ClamAV (`clamd` INSTREAM) adapter + fail-closed default. Sandboxed parsers for PDF, XLSX, CSV, JPEG/PNG/WebP. `fbg_documents` handler: `uploaded → scanning → parsed \| rejected`, promotion, page/cell records, security events, uploader notification. Config gate. CI steps. |
| **Tested** | See §4. Unit 228 (worker), real-stack integration 22, real ClamAV 6, DB suite 183 on real Postgres after two fresh resets; Windows/Node 24 and Linux/Node 22. **CI on the PR had not run when this was written.** |
| **Deployed** | Nothing. |
| **Partial** | Images are re-encoded and promoted but no text is read from them (no OCR). Scanned PDFs are stored with empty text and `ocr: "unavailable"`. Retention: the quarantined upload is removed after `parsed`, but there is no sweep for leftovers or the 7-day purge of rejected files. |
| **Blocked** | OS-level parser isolation (needs the worker host, G1). Scanner decision (ADR-009 / proposed ADR-043). OCR (OQ-14). Real-world file compatibility (no file saved by Excel, WPS or LibreOffice has been parsed; needs authorized samples, B-30). |
| **Planned** | B-05 upload integration against §7; B-19 extraction on the same staged contract (G2); B-28 retention sweep and dead-letter requeue tooling. |

## 1. Baseline, branch, PR #40, files

- **Baseline:** `origin/main` at `4d98b5d` when the work started (latest `main` CI run 43572499120 green). Local `main` checkout was clean and identical.
- **Worktree:** `.claude/worktrees/b12-b13-document-processing`, branch `eng/b12-b13-document-processing`. No such branch existed locally or on the remote.
- **Conflicts with the brief:** two facts had changed since the audit snapshot.
  - PR #40 was no longer a draft when work started, and it **merged into `main` during this session** (`ef87ad6`: B-05 auth, ADR-042, migration 0013). I merged `main` into this branch and re-ran everything on the merged tree. Conflicts were textual only: `ci.yml` (both sides kept), `DECISIONS.md` (ADR-042, then ADR-043–045), `STATUS.md`.
  - `docs/STATUS.md` and `README.md` still described B-11 as unmerged; I corrected only the worker rows and the lines that referenced them.
- **Not touched:** `apps/web/**`, `e2e/**`, `packages/**`, every migration, the public site, the design preview, auth, pricing arithmetic, AI provider contracts. No migration was needed: `security_events.kind` already has `scan_rejected`, and the `documents` status machine already covers every transition used.

**Files changed** (65 files, about 9,760 added lines, of which roughly 4,100 are tests):

- `apps/worker/src/queue/`: `consumer.ts` (staged contract), `errors.ts` (`NotConfiguredJobError`), `testing/fake-store.ts`, new `staged.test.ts`.
- `apps/worker/src/documents/` (new): `job.ts`, `errors.ts`, `limits.ts`, `filename.ts`, `sniff.ts`, `intake.ts`, `storage.ts`, `scanner.ts`, `repo.ts`, `pipeline.ts`, `results.ts`, `runner.ts`, `bootstrap.ts`; `sandbox/{child,guard,probe,protocol,zip,xml,xlsx,csv,pdf,image}.mts` and five test children under `sandbox/testing/`; `testing/{fixtures,fakes}.ts`; nine test files.
- `apps/worker/src/handlers/`: new `documents.ts`, `documents.test.ts`, `documents.integration.test.ts`; `index.ts` (documents handler is an opt-in override; default stays fail-closed); `notifications.test.ts` (one expectation).
- `apps/worker/`: `config.ts` + test, `index.ts`, `package.json` (`pdfjs-dist` 6.5.438, `sharp` 0.35.5, script `test:clamav`), tsconfigs (`.mts` sources), `vitest.clamav.config.ts`, `vitest.integration.config.ts`.
- Root: `package.json` (`engines.node` ≥ 22.13), `pnpm-lock.yaml`, `.env.example`, `CLAUDE.md` §8, `README.md` (two lines), `.github/workflows/ci.yml` (`db` job only).
- Docs: `DECISIONS.md` (ADR-043 proposed, ADR-044, ADR-045), `SECURITY.md` §4, `BACKLOG.md` (B-12, B-13), `STATUS.md`, this report.

## 2. Implemented, partial, blocked, excluded

**Document flow as built**

1. The message carries `{ document_id, org_id }` and nothing else. The worker reads the row for both ids together; a message naming another organization's document finds nothing.
2. The storage path comes from the row and is re-checked to be `<org_id>/<document_id>/<file>` in the quarantine bucket.
3. Download to a private temp file with a streamed 25 MB cap and sha256. If the object is not there, the job is retried and the document is left `uploaded`.
4. Claim: `uploaded → scanning` in one short transaction.
5. Content check: declared MIME, file extension and magic bytes must agree; a PDF or image that is also a ZIP is refused.
6. Scan. Only an explicit `clean` continues.
7. Parse in the sandbox. For an image, the re-encoded copy is checked and scanned again.
8. Promote by uploading the scanned local file to `documents/<org>/<doc>/<sha12>-<ascii-slug>.<ext>`.
9. In the success transaction: `parsed` + pages/cells, or `rejected` + reason (+ `security_events`), plus a notification to the uploader.
10. After commit: delete the quarantined upload of a parsed document.

**What each parser returns**

| Type | Stored | Notes |
|---|---|---|
| PDF | One `document_pages` row per page: text, and positioned runs `[x, y, w, h, text]` in PDF points | English and Chinese verified. Document JavaScript is detected and flagged, never run. Encrypted, damaged or over-500-page files are rejected. |
| XLSX | One `document_cells` row per non-empty cell: sheet, row, column, the cached value, type, number format, ISO date where the format is a date | No formula engine exists in the code. A formula without a cached result is stored as missing and flagged. Macros, macro sheets, embedded objects, ActiveX and a workbook not at its standard location are rejected. |
| CSV | Same shape, sheet `csv`, every field as text | UTF-8, UTF-16 and GB18030 detected. Formula-looking fields are kept as text and flagged. |
| Image | The re-encoded image is promoted; one page row with `text: null` and `ocr: "unavailable"` | Metadata and trailing data are dropped. |

**Deliberately excluded:** OCR; AI extraction and its enqueue; the upload route, signed URLs and access logging (B-05 follow-up); a hosted scanner; any UI; retention sweeps; dead-letter requeue tooling.

## 3. Scanner, isolation architecture, threat model

**Scanner (proposed ADR-043).** ClamAV as a `clamd` sidecar over TCP INSTREAM. A scanner returns a verdict only when the engine examined the bytes; unreachable, timeout, stream limit, an unrecognized reply or a reply that arrives before the whole file was sent raises `ScannerUnavailableError`. No code path turns that into `clean`. Tested against real ClamAV 1.5.4 (signatures 28183, image `clamav/clamav@sha256:45fe5149…`).

**Transaction and lease model (ADR-044).** The B-11 consumer ran handlers inside the success transaction. A handler may now be staged: `prepare` runs under the same ledger claim, heartbeat and timeout but with no transaction open; `commit` runs inside the success transaction as before. The change is about 40 lines in `Consumer.process()`; `QueueStore`, `pg-store.ts` and the claim logic are untouched. I kept it in this PR as its own commit (`e5c0e71`) rather than a separate PR; it can be split out if you prefer to review it alone.

**Parser isolation (ADR-045).** One Node process per document with the permission model (file reads limited to the sandbox sources, one parser library and the input file; no writes, child processes, workers or WASI), an empty environment, no code generation from strings, a heap ceiling, a wall-clock kill and bounded output. A runtime guard closes the network inside the process. A probe run inside the child measures all of this; the worker will not start with document processing enabled unless every check is denied.

**What this is not.** It is not an OS sandbox.

- Node's permission model has no network permission on Node 22 or 24. I measured it: `fetch` and TCP succeed under `--permission`. The network is closed by a guard inside the process, which stops a parser library from fetching something but would not stop injected code.
- Image decoding uses libvips (native code), which needs `--allow-addons` and is outside the permission model entirely.
- The heap ceiling does not bound off-heap memory; the code's own budgets do. There is no cgroup.

Because of this, `DOCUMENT_PROCESSING=enabled` is refused unless `APP_ENV=development` is set explicitly, `NODE_ENV` is not `production`, and both the database and Storage URLs are loopback.

**Platforms:** Windows (local) and Linux (CI image, Node 22) are supported at this tier and tested. On Windows, libuv always passes eleven system variables to a child; a test asserts nothing else gets through. macOS is untested. Node below 22.13 is unsupported.

**Threat model in brief**

| Threat | Control | Residual |
|---|---|---|
| Malware in an upload | Scan before parse and before promotion; fail closed | One engine; signature freshness is a deployment concern |
| File is not what it claims | MIME ↔ extension ↔ magic; allow-list of six types | — |
| Polyglot (valid as two formats) | ZIP directory check for PDFs and images; images re-encoded | PDF polyglots with formats other than ZIP are not detected |
| Decompression bomb | Per-part and total budgets on declared and actual sizes; text and response caps | — |
| Parser exploited by a hostile file | Restricted child, no credentials, validated output | Process-level only; native image decoder unconfined |
| Macro or formula execution | No formula engine; macros and macro sheets rejected; PDF scripting never loaded | — |
| Cross-tenant job | Row read by `(id, org_id)`; path from the row, re-checked | — |
| Worker holds locks during slow work | Staged handler; measured on real Postgres | — |
| Duplicate or concurrent delivery | Ledger key bound to the document; finalize locks the row and checks `scanning` | — |

## 4. Commands, tests, results

All results below are from this session, on the tree after merging `main` at `ef87ad6`.

| Command | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm lint` | clean |
| `pnpm format:check` | clean |
| `pnpm test` | 845 passed: i18n 4, domain 57, ai 48, eval 12, web 313, worker 228, supabase 183 (PGlite) |
| `pnpm verify:production-build` | passed; the same six pre-existing warnings about `/design-preview` 404 bodies |
| `supabase db reset` ×2 on a fresh local stack (CLI 3.1.0, 16 migrations through 0013), then `pnpm test:db` with `DATABASE_URL` | 183/183 on real Postgres |
| `pnpm --filter @fbg/worker test:integration` with `CLAMAV_HOST` set | 22/22 (10 B-11 + 12 pipeline), real ClamAV |
| Same, without `CLAMAV_HOST` | 22/22, scripted fake scanner |
| `pnpm --filter @fbg/worker test:clamav` | 6/6 against real ClamAV |
| Worker typecheck, unit tests and build in a `node:22-bookworm` container (Node 22.23.5) | 228/228, build OK (run before the merge; the merge did not change `apps/worker`) |
| Built `dist/` sandbox smoke run | containment verified; CSV and PDF parsed from compiled `.mjs` |

**Worker unit tests by file (144 new, 228 total):** `handlers/documents.test.ts` 39, `documents/parsers.test.ts` 23, `documents/runner.test.ts` 23, `documents/validation.test.ts` 16, `documents/scanner.test.ts` 14, `queue/staged.test.ts` 12, `documents/storage.test.ts` 6, `config.test.ts` +6, `documents/repo.test.ts` 5.

**Limitations of this evidence**

- CI has not run on the PR yet. The new `db` steps (starting ClamAV, exporting the stack's URL and key) are untested in GitHub Actions; the commands inside them were run locally.
- The Linux run covered unit tests and the build, not the real-stack integration suite. That ran on Windows only.
- All fixtures are synthetic and generated in memory. The XLSX fixtures come from a writer in this repository (hand-written SpreadsheetML), so the XLSX reader has never seen a file produced by a real spreadsheet program. PDFs are read back by pdf.js and images by libvips, which are independent of the fixture code.
- One test I wrote had a wrong expected count (8,016 vs 8,019 cells); the code was right and the test was corrected.
- The EICAR file is assembled in memory and written only to a temp directory; no file in the repository contains it.

## 5. Tenant isolation, quarantine and fail-closed evidence

Integration tests on the real stack, run as the roles named:

- **Cross-tenant job:** a message with organization B's id for A's document is dead-lettered as `document_not_found`; the document stays `uploaded`, nothing is downloaded, no pages are written, nothing appears in a served bucket. An unknown id gets the identical error.
- **RLS as signed-in users:** A's member reads the promoted object and pages; B's member and anonymous see no object, pages, cells or document row.
- **Quarantine:** the uploader cannot see their own quarantined object before or after processing. A rejected upload stays in quarantine; nothing of it exists in a served bucket.
- **Worker-only operations:** a signed-in user cannot insert pages or cells, cannot move their document to `parsed`, cannot write `scan_result`, and cannot call `pgmq.send` or `pgmq.read` (nor can anonymous).
- **EICAR:** rejected with `malware_detected`, `security_events` row with the signature name, uploader notified, never parsed or promoted; a re-queue does not resurrect it.
- **Scanner unavailable:** retried, then dead-lettered after the attempt limit; document stays `scanning`; no pages; nothing promoted.
- **No open transaction:** while the scan is in progress, `pg_stat_activity` shows no `idle in transaction` session and no open `xact_start` for the worker's pool.
- **Recovery:** a document left `scanning` by a failed attempt is completed by the retry, with pages written once. Three simultaneous deliveries produce one run and two duplicates.
- **Cancellation:** a member discarding the document mid-scan (through RLS) results in no promotion and no writes.
- **Job before upload:** leaves the document `uploaded`; after the object arrives, a re-queue completes it.

Unit tests cover parser timeout (child killed, job retried then dead-lettered, document not rejected), heap ceiling, stdout flood, invalid output, and that logs contain no file names, content or keys.

## 6. Security review

I ran an independent adversarial review of the code before committing. It found twelve issues; all are fixed, each with a regression test.

| # | Finding | Fix |
|---|---|---|
| 1 | For images, the re-encoded copy that gets promoted was never scanned or re-checked | The copy must sniff as the expected image, is scanned itself, and only `clean` is promoted; the parent also requires the result kind to match the request |
| 2 | An XLSX could carry unreferenced or embedded parts the size budget ignored | Every part counts toward the declared-size budget; embedded objects and ActiveX are rejected. Measured: ClamAV still detects EICAR behind 120 MB of padding, the most the budget allows |
| 3 | The staging/production gate passed when `APP_ENV` was simply unset | `APP_ENV=development` must be explicit, `NODE_ENV` not production, database and Storage loopback |
| 4 | File-determined failures (duplicate cell addresses, huge output, non-finite PDF coordinates) were retried and stranded the document | The sandbox rejects them with a code; the claim now happens after the download, so an early job cannot strand a document |
| 5 | No total text budget for sheets: a 17 KB file could produce 95 MB of rows | 8 M character budget in child and parent; 48 MB response cap; inserts batched by size |
| 6 | The XLSX reader trusted fixed part names, so a file could show a person one workbook and us another | The reader follows the package's root relationship and requires the standard location; macro sheets are caught by content type and relationship type |
| 7 | The ClamAV adapter accepted a verdict sent before the file had been transmitted | Such a reply is refused; the pipeline continues only on an explicit `clean` |
| 8 | Orphaned objects after a discard; the quarantined original kept forever | Post-commit housekeeping removes them (best effort) |
| 9 | The network guard missed several DNS functions and the promise `Resolver` | Patched by pattern on both APIs; the probe now tries five DNS paths and counts anything but an explicit denial as a breach |
| 10 | Rejection details could carry markup | Character set narrowed |
| 11 | The runner could wait forever on a pipe; temp cleanup failures were silent | Settles on process exit after a grace period; failures logged |
| 12 | Smaller correctness issues (slug normalization, polyglot with trailing bytes, sheet-name validation, date cells, CSV formula prefixes, probe failure handling) | Fixed |

**Review against `docs/SECURITY.md`**

- **Confidentiality:** file content never enters logs, error text, `rejected_reason` or `security_events`; those carry ids, codes, counts and hashes. The service-role key is never logged or echoed in errors. `scan_result` is readable by the document's own organization and shows the scanner engine and version — low risk, worth deciding in the B-05 read path.
- **Tenant isolation:** every statement is keyed on document id and organization id; the worker is `service_role`, so the check is explicit in code.
- **Untrusted input:** file, file name, declared type and the sandbox's output are all treated as hostile and validated.
- **Prompt injection:** not applicable yet (no AI call). The page and cell text stored here is untrusted input for B-19 and must be wrapped as such there.
- **Idempotency:** unchanged ledger semantics; the document-level guard is the `scanning` status check under a row lock.
- **Privileges:** no new grants, no migration.
- **Costs:** none. ClamAV runs locally and in CI as a free container image.
- **Rate limits:** none added (B-28).

## 7. Hand-off contract for the B-05 upload integration

The web tier owns everything up to the queue message. This PR does not touch it.

1. **Register the document** as the signed-in user: insert into `documents` with `status = 'uploaded'`, `storage_bucket = 'quarantine'`, `storage_path = '<org_id>/<document_id>/<file>'`, `original_filename`, `mime`, `bytes`, `source_type`, `rights_class`.
   - `<file>` must be ASCII (`[A-Za-z0-9!_.*'()&$@=;:+,? -]`); Supabase Storage rejects other keys. Use a fixed name such as `upload.bin`; the original name belongs in `original_filename`.
   - `bytes` must be the exact size of the file. A mismatch is rejected (`size_mismatch`).
   - `mime` must be one of the six allowed types and must match the file extension and content.
2. **Upload** the object to that exact path in `quarantine` (signed upload URL; the existing storage policy only accepts it while the row is `uploaded`).
3. **Enqueue after the upload has completed**, server-side, on `fbg_documents`:
   `{ "v": 1, "type": "document.process", "idempotency_key": "document.process:<document_id>:v1", "payload": { "document_id": "<uuid>", "org_id": "<uuid>" } }`.
   Helpers: `documentJobKey()` and `DOCUMENT_PROCESS` in `apps/worker/src/documents/job.ts`. A job that arrives before the object is retried and then dead-lettered, leaving the document `uploaded`.
4. **Read the outcome** from `documents.status`: `parsed` (see `scan_result.parse` for `text_available`, `ocr`, `flags`) or `rejected` (`rejected_reason` = `<code>` or `<code>: <detail>`). The uploader also gets a `document_parsed` / `document_rejected` notification.
5. **Serve** only `parsed`-or-later documents through signed URLs with `app.log_document_access()`. The promoted path is in `documents.storage_path`.
6. **Not yet available:** rate limits on uploads (B-28); re-queue tooling for dead-lettered jobs (key suffix `:rq<n>`).

**For B-19:** check `scan_result.parse.text_available` before extracting; an image or scanned PDF has no text. Use the staged handler contract, with the AI call in `prepare`.

## 8. Founder decisions needed

| Decision | Safe default in place | If deferred |
|---|---|---|
| **Scanner (ADR-009 / ADR-043):** accept ClamAV as the scanner, or choose a hosted API | ClamAV in development and CI; nothing hosted | No effect now. Must be settled before a hosted worker. |
| **OS-level parser isolation (ADR-045, with worker host G1):** which mechanism the chosen host can run (container per parse, gVisor, micro-VM) | Document processing refuses to start outside local development | The pipeline cannot process real uploads anywhere hosted. This is the main blocker for the first pilot. |
| **OCR (OQ-14):** Tesseract self-hosted, a hosted OCR, or a vision model | Images and scanned PDFs are stored without text and flagged | Photo and scan quotes cannot be extracted. Many supplier quotes arrive as images. |
| **`clamd` configuration when hosted:** `AlertExceedsMax yes`, signature update schedule, memory budget (about 1–3 GB) | Stock image in CI | Input to the host decision. |
| **Repository visibility:** GitHub still reports the repository public (OQ-21 says private) | No real data committed; fixtures synthetic | Unchanged; flagged again, no setting touched. |
| **Required checks:** whether the new ClamAV steps in the `db` job should stay there (adds a few minutes) or move to a separate, non-required job | In the `db` job | Slower `db` job. |

## Assumptions

- A rejected document is terminal; the user uploads again. Ambiguous failures (timeouts, crashes) never reject.
- The promoted object key uses an ASCII slug; a Chinese file name becomes `document`. The original name is kept in `original_filename`.
- `documents.sha256` is the hash of the upload. For a re-encoded image the hash of the served copy is in `scan_result.promoted.sha256`.
- Embedded OLE objects and ActiveX controls in a workbook are refused. This may reject some legitimate supplier files; I chose it because the workbook is promoted byte for byte.
- pdf.js runs with `stopAtErrors`, so a damaged PDF is rejected rather than partially read. This may reject files a viewer would open.
- Deleting the quarantined upload after `parsed` follows the "move" in `ARCHITECTURE.md` §3.2.

## Side effects on this machine

- Docker: pulled `clamav/clamav:stable` and `node:22-bookworm`. Container `fbg-clamav-b12b13` is running on `127.0.0.1:3310`. A scratch Supabase stack `fbg-b12b13` is running on ports 5632x (workdir in the session's temp directory). Neither was removed. The other stacks (`sagespan-local`, `fbg-b05b`) were not touched.
- Port 53310 is in a Windows-reserved range on this machine; 3310 was used instead.

## Budget implications

None incurred. ClamAV is free. When hosted it needs memory on the worker host, which affects the G1 choice.

## Founder actions required

1. Review the draft PR. Do not merge until CI is green on it.
2. Decide the items in §8, in particular OS-level isolation with the worker host, since it gates everything hosted.

## Next task

B-05 upload integration against §7 (server action, signed upload URL, enqueue after upload, access logging), then B-19 behind G2.
