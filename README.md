# Factory Bridge Global

> Repository name: `Great-Wall-Bridge` (rename pending founder decision — see `docs/OPEN_QUESTIONS.md` OQ-01).

Factory Bridge Global is a U.S.-facing, software-enabled sourcing and procurement service for B2B buyers working with Chinese manufacturers. It combines bilingual sourcing expertise with software for structured briefs, authorized quote intake, AI-assisted bilingual extraction with human review, like-for-like quote comparison, transparent landed-cost estimates, and evidence-based quality workflows.

It is **not** a marketplace clone of Temu, 1688, Taobao, Weidian or Alibaba.com, and it does not scrape or automate those platforms.

## Current state

**Phase 0 — design only.** This repository contains planning documents and no application code. See `docs/STATUS.md` for the authoritative Implemented / Tested / Deployed / Blocked / Planned table.

## Start here

| Document | Purpose |
|---|---|
| `CLAUDE.md` | How engineering agents must work in this repo (rules, protocol, layout) |
| `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` | Authoritative intended product design |
| `docs/PRODUCT_REQUIREMENTS.md` | MVP scope, user stories, acceptance criteria |
| `docs/ARCHITECTURE.md` | System design, three workspaces, flows, deployment |
| `docs/SCHEMA_PLAN.md` | Tables, enums, RLS policy patterns, migration order |
| `docs/SECURITY.md` | Threat model and controls |
| `docs/INTEGRATIONS_AND_PERMISSIONS.md` | Data-rights matrix for every source |
| `docs/QUOTE_ENGINE_SPEC.md` | Deterministic comparison and landed-cost rules |
| `docs/QUALITY_ASSURANCE.md` | Verification states, badge semantics, sampling limits |
| `docs/AI_EVALUATION_PLAN.md` | AI modules, golden set, gates |
| `docs/UX_INFORMATION_ARCHITECTURE.md` | Sitemap, templates, zh-CN supplier portal, visual system |
| `docs/PILOT_CATEGORY_SELECTION.md` | Which product families to pilot and why |
| `docs/LAUNCH_ECONOMICS.md` | Fixed vs variable costs, who pays, budget gates |
| `docs/ROADMAP.md` · `docs/BACKLOG.md` | Phases with exit gates; ordered backlog with acceptance criteria |
| `docs/DECISIONS.md` · `docs/OPEN_QUESTIONS.md` · `docs/STATUS.md` | Living governance docs |

## Development (future)

Commands listed in `CLAUDE.md` §8 become valid after backlog item B-01 (scaffold). Nothing runs today.
