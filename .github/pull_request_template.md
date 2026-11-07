## Backlog item

B-__ — <title from docs/BACKLOG.md>

## What changed

-

## Status (be exact — see CLAUDE.md §4)

- Implemented:
- Tested (commands + results):
- Deployed:
- Partial / Blocked:

## Security checklist (docs/SECURITY.md)

- [ ] New/changed tenant tables have RLS enabled + forced and a negative test in the RLS suite
- [ ] No service-role usage outside `apps/worker` or `apps/web/src/server/privileged/**`
- [ ] All external input (API body, CSV, webhook, AI output) is zod-validated
- [ ] Untrusted content never reaches a prompt as instructions; no tools in extraction prompts
- [ ] Side effects are idempotent (keys/unique constraints); webhooks verify signatures
- [ ] No secrets, tokens or document contents in logs; `.env.example` updated if a var was added
- [ ] UI copy adds no unsubstantiated claim (PRD §7)

## Docs

- [ ] `docs/STATUS.md` updated
- [ ] `docs/DECISIONS.md` ADR added/updated if a decision was made
