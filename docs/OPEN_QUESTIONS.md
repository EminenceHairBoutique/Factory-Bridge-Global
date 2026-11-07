# OPEN QUESTIONS — Founder Decision Gates

Living document. Each item: what is being decided, why it matters, default assumption the engineering agent will use if unanswered, and whether it blocks a phase. Resolve by writing the answer here **and** recording an ADR in `DECISIONS.md`.

| ID | Question | Why it matters | Default assumption if unanswered | Blocks |
|---|---|---|---|---|
| ~~OQ-01~~ | **Resolved 2026-11-07:** new repo `EminenceHairBoutique/Factory-Bridge-Global`; "Great Wall Bridge" retired (ADR-014). Remaining: archive the old GitHub repo. | — | — | — |
| ~~OQ-01b~~ | **Resolved 2026-11-07:** founder approved removal of the duplicate under `docs/research/`; removed in the Phase 0.5 branch (`git rm`, history preserved). | — | — | — |
| **OQ-02** | Legal entity, registered address, DBA/trademark, and whether "U.S.-based" may be claimed | FTC substantiation; public copy; contracts | No "U.S.-based" claim on site; "Operated from New Jersey, USA" only after entity verified | Public site launch |
| **OQ-03** | **Partially resolved 2026-11-07:** draft the bilingual form now (B-00b); **external use blocked until counsel review** (OQ-06). | Nothing supplier-provided can be shown to buyers without it | Only `internal_only` catalog data until approved | Phase 1 buyer-visible supplier data |
| **OQ-04** | **Engineering default resolved 2026-11-07 (ADR-026):** buyer-side adviser/facilitator; FBG is never buyer/importer of record; disclosed service fees. **Still open:** formal commercial terms, fee schedule, who contracts inspectors/forwarders (legal/commercial approval). | Liability, pricing pages, contract templates | as decided | Pilot agreements, Phase 3 |
| **OQ-05** | Supplier anonymization: do buyers see supplier legal names before engagement, or codes (S-A, S-B) until a fee/contract stage? | Disintermediation risk vs trust | Buyers see supplier display name + city + verification state; contacts never, unless granted | Comparison UI, exports |
| **OQ-06** | Engage counsel for: PIPL/cross-border supplier contact data, platform-terms review (1688/Alibaba.com/Weidian), pilot agreement, privacy policy | Legal exposure | Minimize personal data; no connectors; pilot agreement drafted by counsel | Phase 1 external pilots |
| **OQ-07** | Retention periods: source documents, quotes, contacts, audit logs | Storage, deletion workflow, legal holds | Documents: project life + 3 years; accepted quotes tied to orders: 7 years; audit: 7 years; contacts: while relationship active + 2 years | Deletion feature |
| **OQ-08** | Pursue 1688 / Alibaba.com / Weidian developer registration in 2027 at all? | Engineering time, licensing cost | No; manual research + direct authorization only | Phase 4 scope |
| **OQ-09** | Pilot agreement terms: confidentiality, data license from buyer for uploaded documents, no-guarantee language, fee | Needed before first external buyer uploads anything | Draft template in Phase 1; counsel review | First external pilot |
| **OQ-10** | Data residency: U.S.-East Supabase region for everything? Any PRC-resident data requirement for supplier portal? | PIPL, latency for Chinese suppliers | Single U.S. region; revisit if counsel requires | Phase 2 supplier portal |
| **OQ-11** | Confirm pgvector / zhparser / pg_jieba availability on the Supabase image for ZH search | Search design | Trigram + pgvector fallback | Phase 2 search |
| **OQ-12** | Any quality remedy / guarantee program? Insurance? | Public claims, contracts, cash exposure | None offered; software supports future policy | Public QA copy |
| **OQ-13** | FX provider; second AI provider for eval | Cost, accuracy | ECB-derived free feed; Anthropic only | Nothing |
| **OQ-14** | OCR engine (Tesseract chi_sim self-hosted vs hosted) and vision-model use on scans | Cost per doc, accuracy | Tesseract first; vision on low-confidence pages | Phase 1 extraction |
| ~~OQ-15~~ | **Resolved 2026-11-07 (ADR-013):** Pilot A labels + folding cartons; Pilot B hair bundles (internal design partner). Fixed pilot specs in `PILOT_CATEGORY_SELECTION.md` §6 stand unless the founder edits them. | — | — | — |
| **OQ-16** | **Decided 2026-11-07 (ADR-028): deferred.** No paid accounts, no production deployment. Local dev + GitHub Actions only. Revisit before the first external pilot. | Cash; environments | as decided | B-29 |
| **OQ-17** | Who are the first 2–3 external buyer design partners, and is the founder's hair brand an internal tenant? | Pilot data, feedback loop | Hair brand = internal design-partner tenant; externals recruited in validation sprint | Phase 1 pilot |
| **OQ-18** | Operator staffing: founder only in Phase 1, or one part-time bilingual operator? | SLA promises, support cost | Founder only | Speed metrics |
| **OQ-19** | Approval rules: who may approve outbound supplier messages, mark quotes confirmed, and authorize sample purchases | Policy matrix | Founder/platform_admin only in Phase 1 | Policy module |
| **OQ-21** | GitHub repo `Factory-Bridge-Global` is **public** and contains operating/competitive planning docs. Make it private? | Competitive exposure; supplier-relationship details will follow | Agent changes nothing; founder decides in GitHub Settings → General → Danger zone | Nothing technical |
| ~~OQ-20~~ | **Resolved 2026-11-07 (ADR-027):** PR-only, required CI checks. Founder configures the GitHub ruleset (steps in `STATUS.md`). | — | — | — |

## Missing legal/commercial decisions summary (for the founder's attorney and accountant)

1. Entity + claims substantiation (OQ-02).
2. Supplier data authorization form, PIPL basis for contacts (OQ-03, OQ-06).
3. Pilot buyer agreement incl. no-guarantee and data license (OQ-09).
4. Business model and role in transactions (OQ-04); insurance (OQ-12).
5. Retention and deletion policy (OQ-07).
6. Platform-terms posture for any future marketplace connector (OQ-08).
