# Sign-in, Invitation and Organization Setup — Prototyped Screens

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #10). Routes `/design-preview/auth`, `/design-preview/auth/invite`, `/design-preview/auth/org-setup`; dev only, 404 in production builds. Design input for BACKLOG B-05 (Supabase Auth: email OTP + password, org creation, invites, role gating). Nothing authenticates; no credential leaves the page.

## 1. Frame

`AuthFrame`: 420 px raised card on the canvas (720 px for organization setup), brand mark, demo stripe, appearance switch and language-aware footer; follows Atlas or Obsidian like the rest of the preview.

## 2. Sign-in (`AuthSignIn.tsx`)

| State | Content | Rule shown |
|---|---|---|
| Email | work email, "Email me a code", secondary link "Use a password instead" | one-time code is the primary path |
| Code | 6-digit input with `autocomplete="one-time-code"`, expiry note (10 min), resend, change email | after several wrong attempts the code is invalidated |
| Password | email + password, "Forgot your password?", "Email me a code instead" | length-first policy (12+ characters), no composition rules |
| Forgot | email → "If that address has an account, the link is on its way", 15-minute validity | **no account enumeration**: identical copy whether or not the address exists |
| Signed in | links to the buyer and supplier workspaces | real flow routes by organization type; membership is checked on every request |

Copy is available in English and 简体中文 (card-level toggle) because suppliers use the same entrance.

## 3. Invitation (`AuthInvite.tsx`)

Names the organization and its type, the inviter, the invited address, the expiry (7 days) and the **role with its summary and the can/cannot list** from a single role table (`ROLE_EXPLANATION`, derived from SECURITY_PERMISSION_MATRIX §2). Accepting asks for the person's name and proves ownership of the invited address with a one-time code; no password. The joined state says the owner can change the role at any time and that other sessions are signed out on a role change. An "Expired" demo scenario shows that an expired invitation grants nothing.

## 4. Organization setup (`OrgSetup.tsx`)

Three steps for buyers only (suppliers go through 供应商申请):

1. **Company**: legal name, DBA, state, website, "what best describes you" (brand, agency, distributor, procurement team, contract manufacturer).
2. **Destination and categories**: default delivery ZIP (validated), annual volume band ("only guides which operator is assigned"), categories (pilot families plus "another category, needs review"), the blocked-categories sentence, and a pilot-terms acknowledgement ("a written pilot agreement arrives before any supplier is contacted").
3. **Invite your team**: owner shown with the advice to add an admin so approvals never depend on one person; rows of email + role (admin / member / viewer) with inline role cards; duplicate, invalid and own-address entries blocked; invitations valid 7 days.

Created state: organization name, invitations sent, links to start a sourcing request or open the overview. The workspace is described as empty and private until a request starts.

## 5. Roles (shared table)

| Role | Summary | Can (excerpt) | Cannot (excerpt) |
|---|---|---|---|
| Owner | Runs the organization and is accountable for approvals | transfer ownership, billing and pilot terms, approve supplier selection and handoff | be removed while sole owner |
| Admin | Manages people and settings; approves outbound messages | invite and remove members, change roles below owner, approve clarifications and RFQs | transfer ownership, change billing |
| Member | Does the sourcing work | create projects and briefs, upload, review extractions, approve clarifications | invite people, approve selection or handoff |
| Viewer | Reads everything; changes nothing | open projects, comparisons, reports; download exports | create, edit, approve, see audit trails |

## 6. Verified in the browser

Sign-in: empty submit shows the email error; a valid email moves to the code step; a short code is rejected; "123 456" signs in; the 中文 toggle swaps the copy. Password path and forgot-password reach the non-enumerating confirmation. Invitation: role card shows can/cannot; name + code joins; the Expired scenario shows the expired state. Organization setup: empty continue shows errors; valid company and needs steps pass; the owner's own address is rejected as an invite; a colleague's address creates the organization with "1 invitation sent". No console errors; no horizontal overflow at 320, 375 and 768 px in Obsidian.

## 7. Contract the UI assumes (handoff H-31)

Supabase email OTP as the primary factor with a 10-minute code and attempt limit; password as an optional second method with a length-first policy; password reset that never reveals whether an address exists; invitations with role, inviter, expiry and acceptance by proving the invited address; organization creation writing `organizations` + owner `memberships` + `invites` (migration 0002 functions `create_organization`, `create_invite`, `accept_invite`); live membership checks and session revocation on role change (already specified in the permission matrix); routing by `org_type` after sign-in.

## 8. Not built

Real auth, email sending, org switcher, settings pages, supplier application form (供应商申请), session management UI.
