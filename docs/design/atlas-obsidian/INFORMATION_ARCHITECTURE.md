# Information Architecture — Atlas × Obsidian

**Crosswalk:** the normative sitemap and vocabulary remain `docs/UX_INFORMATION_ARCHITECTURE.md`; the design-track rendering of it is `docs/design/INFORMATION_ARCHITECTURE.md`. This document records only what the Atlas × Obsidian direction **changes or adds**: the public-site sitemap, the revised buyer sidebar, the four-tab mobile IA, and the role journeys. Nothing here alters routes, permissions or terminology.

## 1. Public marketing site (`/`, English)

```
Top bar (desktop):  [mark] How it works · Services · Categories · Quality process · About      Sign in · [Start a request]
Top bar (narrow):   [mark]                                                                    [Start a request] ☰
                    ☰ opens a full-width drawer with the five links and the appearance switch
```

| Page | Purpose | Status |
|---|---|---|
| `/` Home | Obsidian hero (headline, supporting line, primary + secondary CTA, bridge figure), Atlas value pillars, process timeline, pilot category cards, evidence explanation, Obsidian closing CTA | Prototyped at `/design-preview/marketing` |
| `/how-it-works` | Brief → research and authorized options → quote comparison → documented checks → handoff; each step says who acts | Specified in `PAGE_BY_PAGE_BLUEPRINT.md` §1.2 |
| `/services` | Editorial blocks: supplier discovery, bilingual clarification, quote intelligence, verification and coordination | Specified |
| `/categories` | Labels, folding cartons, hair bundles; requirement examples; "request another category" | Specified |
| `/quality-process` | What is checked, badge meanings, sample vs batch, limits | Specified |
| `/pricing` | Pilot pricing by conversation (OQ-04 pending) | Specified |
| `/about` | Entity facts only after OQ-02 | Specified |
| `/contact`, `/faq` | MOQ, timing, quality, confidentiality, next steps | Specified |
| `/suppliers/apply` 供应商申请 | Simplified-Chinese-first form; no backend yet | Specified |

## 2. Buyer workspace (`/app`)

### 2.1 Desktop sidebar (revised order)

```
[mark] Factory Bridge Global / Buyer workspace
  Overview
  Projects
  Quotes          → global quotes view (future: reuses permissioned quote records; today links to the project comparison)
  Messages        → Inbox (approval stages visible)
  Documents       → global documents view (future)
  ─────────────
  Organization
  Team and account
  Appearance  [Atlas · Obsidian · System]
  Collapse
```

Project subnavigation (tabs inside a project): Overview · Brief · Supplier options · Compare · Documents · Reports · Activity.

### 2.2 Phone IA: four tabs

```
┌─────────────────────────────┐
│ ☰  Page title    EN 中文  🔔 │   ☰ → navigation sheet (all destinations + appearance)
│ …                           │
│ [Start a sourcing request]  │   ← prominent action on Home and Projects, not a tab
│ …                           │
├─────────────────────────────┤
│  Home   Projects  Inbox  Account │
└─────────────────────────────┘
```

Quotes, documents and reports are contextual project screens reached from Projects; they are not tabs. Comparison becomes swipeable supplier cards with a disclosure ("Show details") and a "What is missing" line per card.

### 2.3 Buyer journeys

| Journey | Desktop | Phone |
|---|---|---|
| Create a brief | 5-step wizard, side stepper | 5 steps, horizontal stepper, sticky Back / Save draft / Continue above the tab bar |
| Review extraction | split view | read-only summary + "Continue on desktop" |
| Compare quotes | matrix per basis group, evidence drawer right | card carousel per group, evidence panel below, compare toggle per card |
| Approve a clarification or an RFQ | dialog with bilingual draft, send disabled until operator approval | bottom sheet, same rule |
| Export a report | dialog with format and contents; generation server-side | same sheet |

## 3. Internal operations (`/ops`)

Sidebar: Work queue · Projects · Research · Suppliers · Reviews · Cases · Admin; bottom: Outreach approvals · Account · Appearance. Phone tabs: Queue · Projects · Reviews · Account. A command palette with permission-safe search is planned, not prototyped. Restricted supplier contacts stay behind RLS and assignment; the UI's "hidden" line is a reflection of that, never the control.

## 4. Supplier (`/supplier`, Phase 2 concept)

Chinese-first sidebar: 工作台 · 企业资料 · 产品目录 · 阶梯报价 · 询价单 · 文件与消息 · 数据共享设置; phone tabs: 工作台 · 询价单 · 报价 · 账户. Specified in `PAGE_BY_PAGE_BLUEPRINT.md` §4; not prototyped this session.

## 5. Device matrix

| Width | Shell | Comparison | Wizard | Review |
|---|---|---|---|---|
| 320–389 | top bar + 4 tabs + sheet | cards, 86 vw | horizontal stepper, wrapping action bar | pane toggle |
| 390–767 | same | cards, 22 rem | same | pane toggle |
| 768–1023 | collapsible rail | cards | horizontal stepper | pane toggle |
| 1024–1279 | rail | matrix, evidence panel below | vertical stepper | split |
| 1280–1439 | rail | matrix + right drawer (384 px) | vertical stepper | split + sticky queue |
| ≥ 1440 | rail, 40 px gutters | same | same | same |
