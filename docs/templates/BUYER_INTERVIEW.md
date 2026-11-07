# DRAFT — NOT FOR USE UNTIL COUNSEL REVIEW (OQ-06)

# Buyer Interview Script (30 minutes) + Scoring Sheet

> **Status:** Phase 1 draft (`docs/BACKLOG.md` B-00b). Supports the 30-day validation sprint in `docs/PILOT_CATEGORY_SELECTION.md` §5, weeks 1–2.
> **Purpose:** produce the *measured* inputs that replace the hypothesis scores for criteria **C2, C7, C8, C10** in `docs/PILOT_CATEGORY_SELECTION.md` §2. Every scored question below names the criterion it feeds and the unit it must be recorded in.
> **Counsel note (OQ-06):** the consent wording in Block 0 and the data-handling rules below are drafts. Counsel should confirm the recording consent language and the state-privacy posture before any interview is run with an external buyer. The founder's own hair brand counts as an internal tenant, not an external interview.
>
> **Two tracks.** The script is shared; where a question differs by track it is marked **[LABELS/CARTONS]** (U.S. brand buyers of custom pressure-sensitive roll labels and printed folding cartons, Pilot A) or **[HAIR]** (U.S. hair vendors buying human-hair bundles/wefts, Pilot B). Unmarked questions are asked on both tracks.

---

## Rules for the interviewer

1. **Record numbers, not adjectives.** Every C-criterion question has a unit. If the interviewee gives a range, write the range and ask which end is typical. If they do not know, write `unknown`, never a guess.
2. **No pitch before Block 5.** Do not describe the product until willingness-to-pay is reached; earlier description biases C2.
3. **Data minimization.** Record company name, interviewee role, and one business contact (work email or work phone). Do **not** record personal phone numbers, home addresses, or any supplier's individual contact details the interviewee mentions. If they show supplier chats or invoices, do not photograph them; note only the business facts (price, quantity, defect).
4. **No claims.** Do not say "lowest price", "verified factories", "guaranteed delivery" or quote savings figures (CLAUDE.md §4). Say: "we are testing whether a structured sourcing workflow is worth paying for."
5. **One sheet per interview.** File the scoring sheet (page 2) in the interview folder named `YYYY-MM-DD_<track>_<company-slug>.md`. Aggregate counts go to the §2 scorecard, not individual answers.
6. **Qualified interview** (counts toward C2) = the interviewee has personally placed or approved at least one order in the track's family in the last 12 months. Record disqualified interviews but do not count them.

---

## Timing overview

| Block | Minutes | Covers | Criteria fed |
|---|---|---|---|
| 0 | 0–2 | Consent, framing | — |
| 1 | 2–7 | Buyer profile, qualification | C2 (qualified?) |
| 2 | 7–13 | Current sourcing process and pain | context for C2 |
| 3 | 13–19 | Volumes, reorders, order value | **C7, C8** |
| 4 | 19–24 | Defects and disputes | **C10** |
| 5 | 24–29 | Willingness to pay | **C2, C8** |
| 6 | 29–30 | Close, follow-up permission | — |

---

## Block 0 — Consent and framing (0–2 min)

Read aloud:

> "Thanks for making time. I'm researching how U.S. brands source **[LABELS/CARTONS: custom labels and cartons] [HAIR: human-hair bundles]** from Chinese factories. This is research, not a sales call; there is nothing to buy today. I'll take written notes on your business process. I won't record names of your suppliers' staff or any personal contact details. **[If recording:] May I record audio for my own note-taking only? I'll delete it within 30 days.**"

- [ ] Verbal consent to notes obtained
- [ ] Audio recording: `yes` / `no` / `not asked` *(counsel to confirm consent wording and retention, OQ-06)*

---

## Block 1 — Profile and qualification (2–7 min)

| # | Question | Record as |
|---|---|---|
| 1.1 | What does your company sell, and roughly how many SKUs use **[LABELS/CARTONS: custom printed packaging] [HAIR: hair bundles/wefts]**? | free text; SKU count (integer or range) |
| 1.2 | What is your role in packaging/hair purchasing: do you choose suppliers, approve orders, or both? | `chooses` / `approves` / `both` / `neither` |
| 1.3 | When did you last personally place or approve an order in this category? | month/year |
| 1.4 | Who else at your company is involved in a purchase decision? (roles only, no names) | roles |
| 1.5 | **[LABELS/CARTONS]** Which do you buy: roll labels, folding cartons, both? **[HAIR]** Which constructions: machine weft, hand-tied, closures/frontals, wigs? | list |

**Qualification check (C2):** 1.3 within 12 months **and** 1.2 ≠ `neither` → `qualified = yes`. Otherwise finish politely in 10 minutes and mark `qualified = no`.

---

## Block 2 — Current sourcing process (7–13 min)

| # | Question | Record as |
|---|---|---|
| 2.1 | Walk me through your last order from first contact to goods arriving. Where did you find the supplier? | steps; source (`existing relationship` / `1688` / `Alibaba.com` / `trade show` / `referral` / `agent` / `other`) |
| 2.2 | How many suppliers did you ask for a quote, and how many actually replied with a usable quote? | integers: asked / replied |
| 2.3 | How did you compare quotes: same spec, same quantity, same shipping terms? | `yes` / `partly` / `no`, notes |
| 2.4 | How many hours of your own (or your team's) time did that order take from brief to purchase decision? | hours (integer or range) |
| 2.5 | What went wrong or took longest? | free text — tag: `language`, `spec drift`, `shipping cost surprise`, `sample delay`, `quality`, `payment`, `other` |
| 2.6 | Do you use an agent, sourcing company, or freight forwarder today? What do they charge? | yes/no; fee basis (`% of goods`, `per order`, `monthly`, `hidden in price`, `unknown`); amount |

---

## Block 3 — Volumes, reorders, order value (13–19 min) → **C7, C8**

| # | Question | Record as | Feeds |
|---|---|---|---|
| 3.1 | In the last 12 months, how many separate purchase orders did you place in this category (count reorders of the same item separately)? | integer | **C7** (reorders per year) |
| 3.2 | Of those, how many were reorders of an item you had bought before, versus new items? | integers: reorders / new | **C7** |
| 3.3 | What is the typical value of one order, goods only, in USD? If you pay in RMB, give RMB and I'll note the currency. | amount + currency; typical and range | **C8** (typical order value) |
| 3.4 | What is the largest single order in the last 12 months? | amount + currency | C8 context |
| 3.5 | Roughly what share of that order value is shipping, duties and fees on top of the factory price? | % or `unknown` | C6 context (not scored here) |
| 3.6 | **[LABELS/CARTONS]** Typical quantity per order: labels per SKU per order; cartons per SKU per order? **[HAIR]** Typical bundles per order and lengths mix? | integers / list | spec-template input (§6 fixed specs) |
| 3.7 | How often do you expect to reorder in the next 12 months: more, same, fewer? Why? | `more` / `same` / `fewer`; reason | C7 trend |

**Derived fields:** `orders_per_year = 3.1`; `reorders_per_year = 3.2 reorders`; `typical_order_value_usd = 3.3` (convert RMB at the sprint's fixed reference rate, note the rate used; this is a research estimate, not an FX computation for any quote).

---

## Block 4 — Defects and disputes (19–24 min) → **C10**

Ask about the **last three** orders, or the last 12 months if fewer than three.

| # | Question | Record as | Feeds |
|---|---|---|---|
| 4.1 | Did any order arrive with a problem you had to act on? Describe each one briefly. | one row per incident | **C10** |
| 4.2 | For each incident: what exactly was wrong? | classify per table below | **C10** |
| 4.3 | What did it cost you: rework, discount, reorder, lost sales, time? | USD estimate or `unknown`; hours | C10 severity weight |
| 4.4 | How was it resolved: supplier remade, partial refund, you absorbed it, dispute unresolved? | `remade` / `refund` / `absorbed` / `unresolved` | C10 |
| 4.5 | Did you inspect before shipment or on arrival? Who inspected? | `pre-shipment third party` / `pre-shipment supplier photos` / `on arrival` / `none` | C4 context |

**Severity classification (use the project's own classes from `docs/QUALITY_ASSURANCE.md`; do not invent new ones):**

| Family | Critical | Major | Minor |
|---|---|---|---|
| Roll labels | wrong artwork/text; missing regulatory text | color outside tolerance; misregistration; lifting edges; wrong unwind | small specks outside live area |
| Folding cartons | wrong dieline; unreadable barcode | cracking on folds; color shift; glue failure | scuffs on non-face panels |
| Hair bundles | synthetic blend; misrepresented processing | shedding beyond threshold; weight short; length short | slight odor removable by wash |

Record per interview: `incidents_total`, `incidents_critical`, `incidents_major`, `incidents_minor`. C10 pass condition from §2 is "mostly major/minor, rarely critical": compute `critical_share = incidents_critical / incidents_total` across all qualified interviews on the track.

---

## Block 5 — Willingness to pay (24–29 min) → **C2, C8**

Now describe the workflow in two sentences, without claims:

> "We're testing a service where you send one brief, we collect quotes from several factories on exactly the same spec, translate and line them up side by side with shipping and duty estimates, and coordinate a sample check before you commit. A human reviews every quote; nothing is automated ordering."

| # | Question | Record as | Feeds |
|---|---|---|---|
| 5.1 | On your last order, would that have changed your decision or saved you time? How much time? | `yes` / `no` / `maybe`; hours | C2 context |
| 5.2 | Which of these would you pay for, if any: (a) a fee per completed comparison with at least three confirmed quotes, (b) a percentage of goods value for managed sourcing including QA coordination, (c) a monthly subscription, (d) none? | tick all that apply | **C2** ("would pay") |
| 5.3 | For (a): what amount per comparison would be acceptable, and at what amount would you walk away? | USD acceptable / USD walk-away | **C8** fee plausibility |
| 5.4 | For (b): would a disclosed service fee of **8–15 % of goods value** be acceptable on an order of your typical size (restate their 3.3 number)? What percentage feels fair? | `yes` / `no` / `depends`; % | **C8** (8–15 % hypothesis) |
| 5.5 | For (c): what monthly amount, and what would have to be included? | USD / month; must-haves | C8 context |
| 5.6 | What would make you *not* use this even if it were free? | free text — tag: `trust`, `existing agent`, `volume too small`, `want direct relationship`, `other` | C2 refusal reason |
| 5.7 | Would you be willing to run **one real order** through this workflow in the next 60 days as a pilot, with the fee disclosed up front? | `yes` / `no` / `maybe` | C2 pilot conversion |

**"Would pay" rule (C2):** count the interview as `would_pay = yes` only if 5.2 includes (a), (b) or (c) **and** 5.3, 5.4 or 5.5 gives a non-zero number. A "maybe" with no number is `would_pay = no`. Record the refusal reason from 5.6 either way (required by `docs/PILOT_CATEGORY_SELECTION.md` §3).

---

## Block 6 — Close (29–30 min)

| # | Question | Record as |
|---|---|---|
| 6.1 | May I follow up by email once with a summary and, if you agreed in 5.7, pilot details? | `yes` / `no`; work email only |
| 6.2 | Is there one other brand or vendor you'd suggest I speak to? (company name only; I'll find my own contact) | company name or `none` |

Thank them. Do not promise pricing, timelines or supplier names.

---

## Mapping to the §2 scorecard

After all interviews on a track, compute these and overwrite the hypothesis scores in `docs/PILOT_CATEGORY_SELECTION.md` §2.1 (record the decision in `docs/DECISIONS.md` ADR-013 per §5 week 4):

| Criterion | Measured value | Source questions | Pass threshold (§2) |
|---|---|---|---|
| **C2** | `qualified_interviews` (count); `would_pay_count` (count) | Block 1 qualification; 5.2–5.5 | ≥ 8 interviews; ≥ 3 would pay |
| **C7** | median `reorders_per_year` across qualified interviews | 3.1, 3.2 | ≥ 3 |
| **C8** | median `typical_order_value_usd`; share answering `yes` to 5.4 or giving a non-zero 5.3 | 3.3, 5.3, 5.4 | ≥ US $3k typical order; fee of 8–15 % or $ retainer plausible |
| **C10** | `critical_share`; distribution of incidents by class | 4.1–4.4 | mostly major/minor, rarely critical |

Convert measured values to the 1–5 scale only at the end, and write the raw counts next to the score so the scale can be re-derived.

---

---

# Page 2 — Scoring sheet (one per interview)

```
BUYER INTERVIEW — SCORING SHEET                 DRAFT — NOT FOR USE UNTIL COUNSEL REVIEW (OQ-06)

Date: ____-__-__    Interviewer: ____________    Track: [ ] LABELS/CARTONS  [ ] HAIR
Company: ______________________    Interviewee role: ______________
Business contact (work email OR work phone, one only): ______________________
Consent: notes [ ] yes    audio [ ] yes [ ] no [ ] not asked    Delete audio by: ____-__-__

QUALIFICATION (C2)
  Last order personally placed/approved (1.3): ___/____     Role (1.2): [ ] chooses [ ] approves [ ] both [ ] neither
  => qualified: [ ] yes  [ ] no        (yes = within 12 months AND role != neither)

CURRENT PROCESS (context)
  Supplier source (2.1): ______________   Quotes asked / replied (2.2): ____ / ____
  Comparable quotes (2.3): [ ] yes [ ] partly [ ] no       Hours per order (2.4): ______
  Biggest pain tag (2.5): [ ] language [ ] spec drift [ ] shipping cost [ ] sample delay [ ] quality [ ] payment [ ] other
  Uses agent/forwarder (2.6): [ ] yes [ ] no   fee basis: ____________  amount: ________

VOLUMES & VALUE (C7, C8)
  Orders last 12 months (3.1): ______      Reorders / new (3.2): ______ / ______
  Typical order value (3.3): ________ currency ____   Range: ________ to ________
  Largest order (3.4): ________          Landed add-on share (3.5): ____ %  [ ] unknown
  Typical qty per order (3.6): ______________________
  Next-12-month trend (3.7): [ ] more [ ] same [ ] fewer   why: ______________________

DEFECTS (C10)  — one line per incident, last 3 orders
  #  what was wrong                      class (crit/maj/min)   cost USD / hrs   resolution
  1  _________________________________   [ ]C [ ]M [ ]m        ______ / ____    [ ]remade [ ]refund [ ]absorbed [ ]unresolved
  2  _________________________________   [ ]C [ ]M [ ]m        ______ / ____    [ ]remade [ ]refund [ ]absorbed [ ]unresolved
  3  _________________________________   [ ]C [ ]M [ ]m        ______ / ____    [ ]remade [ ]refund [ ]absorbed [ ]unresolved
  Totals: incidents ____  critical ____  major ____  minor ____     Inspection (4.5): ______________

WILLINGNESS TO PAY (C2, C8)
  Would it have helped last order (5.1): [ ] yes [ ] no [ ] maybe   hours saved: ____
  Would pay for (5.2): [ ] a per-comparison fee  [ ] b % managed sourcing  [ ] c subscription  [ ] d none
  (a) acceptable USD ______  walk-away USD ______        (c) USD/month ______  must-haves: ______________
  (b) 8–15 % acceptable at typical order (5.4): [ ] yes [ ] no [ ] depends    fair %: ____
  => would_pay: [ ] yes  [ ] no   (yes = a/b/c ticked AND a non-zero number given)
  Refusal / hesitation reason (5.6): [ ] trust [ ] existing agent [ ] volume too small [ ] direct relationship [ ] other: ______
  Pilot in 60 days (5.7): [ ] yes [ ] no [ ] maybe

CLOSE
  Follow-up email OK (6.1): [ ] yes [ ] no        Referral company (6.2): ______________________

DERIVED (fill after interview)
  orders_per_year = ____   reorders_per_year = ____   typical_order_value_usd = ______ (FX ref rate used: ______)
  incidents_total = ____   critical_share = ____      would_pay = [ ] yes [ ] no     qualified = [ ] yes [ ] no

File as: interviews/YYYY-MM-DD_<track>_<company-slug>.md   — no personal data beyond the one business contact above.
```
