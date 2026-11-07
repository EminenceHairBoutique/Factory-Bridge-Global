# OPEN QUESTIONS — Founder Decision Gates

Living document. Each item: what is being decided, why it matters, default assumption the engineering agent will use if unanswered, and whether it blocks a phase. Resolve by writing the answer here **and** recording an ADR in `DECISIONS.md`.

| ID | Question | Why it matters | Default assumption if unanswered | Blocks |
|---|---|---|---|---|
| **OQ-01** | Product/repo naming: rename repo to `factory-bridge-global`? Keep "Great Wall Bridge" as anything? | Consistency in code, domains, legal docs | Docs/code say "Factory Bridge Global"; repo name unchanged | Public site copy |
| **OQ-01b** | Spec now exists at `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` **and** `docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` (identical). Delete the `docs/research/` copy? | Two copies will drift | `docs/` copy is canonical; agent never edits the research copy | Nothing |
| **OQ-02** | Legal entity, registered address, DBA/trademark, and whether "U.S.-based" may be claimed | FTC substantiation; public copy; contracts | No "U.S.-based" claim on site; "Operated from New Jersey, USA" only after entity verified | Public site launch |
| **OQ-03** | Approve the bilingual supplier data-authorization form (after counsel) | Nothing supplier-provided can be shown to buyers without it | Only `internal_only` catalog data until approved | Phase 1 buyer-visible supplier data |
| **OQ-04** | Business model for pilots: software subscription, per-request fee, managed sourcing %, or hybrid? Who contracts inspectors/forwarders? Is FBG ever buyer of record? | Liability, pricing pages, contract templates, what the "accept quote" button does | Buyer-side adviser only; buyer contracts directly; FBG charges a disclosed fee; no reselling | Pilot agreements, Phase 3 |
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
| **OQ-15** | Approve pilot families (Pilot A labels+cartons, Pilot B hair bundles) and the fixed pilot specs | Seeds, QSR templates, golden fixtures | Proceed with A+B as proposed | Phase 1 seeds |
| **OQ-16** | Approve paid accounts: Supabase Pro, Vercel Pro, worker host, Resend, Sentry (gate G1) | Cash; environments | Free tiers / local dev only until approved | Phase 1 deployment |
| **OQ-17** | Who are the first 2–3 external buyer design partners, and is the founder's hair brand an internal tenant? | Pilot data, feedback loop | Hair brand = internal design-partner tenant; externals recruited in validation sprint | Phase 1 pilot |
| **OQ-18** | Operator staffing: founder only in Phase 1, or one part-time bilingual operator? | SLA promises, support cost | Founder only | Speed metrics |
| **OQ-19** | Approval rules: who may approve outbound supplier messages, mark quotes confirmed, and authorize sample purchases | Policy matrix | Founder/platform_admin only in Phase 1 | Policy module |
| **OQ-20** | Repo hygiene: adopt branch protection + PR-only merges to `main` now? | Prevent accidental pushes of secrets/broken migrations | Yes, from first code PR | Phase 1 |

## Missing legal/commercial decisions summary (for the founder's attorney and accountant)

1. Entity + claims substantiation (OQ-02).
2. Supplier data authorization form, PIPL basis for contacts (OQ-03, OQ-06).
3. Pilot buyer agreement incl. no-guarantee and data license (OQ-09).
4. Business model and role in transactions (OQ-04); insurance (OQ-12).
5. Retention and deletion policy (OQ-07).
6. Platform-terms posture for any future marketplace connector (OQ-08).
