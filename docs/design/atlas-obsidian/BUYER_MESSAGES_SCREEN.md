# Buyer Messages and Approvals — Prototyped Screen

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #14). Route `/design-preview/buyer/messages?thread=`; dev only, 404 in production builds. Implements the buyer sidebar's "Messages → Inbox (approval stages visible)" (Atlas IA §2.1), the project route `/app/projects/[id]/messages` ("Clarifications & follow-ups, approval states visible"), PRD R-10 / AC-B6.1 and ADR-012. Synthetic data only; nothing is sent.

## 1. Job

Give the buyer one place to see every exchange with a supplier and to do the one thing that is theirs: approve the wording of what goes out. Make the two-approval gate visible on every outbound message, show replies in the supplier's own Chinese with a checked translation, and make the channel and confidentiality rules legible rather than implied.

## 2. Reuse and refinement

| Existing | Decision |
|---|---|
| Approval chain drawn by hand in the project overview, the comparison's clarification dialog and the operator work queue | One shared chip component (`ui/ApprovalChain.tsx`) fed by `approvalChain` in the helper: You → Operator → Sent via <channel>, exactly one step waiting, a returned step sends the draft back to the buyer. |
| Project overview's own thread records (`PROJECT_MESSAGES`) | Replaced by `demo-data/messages.ts`; the overview's Messages tab reads the shared threads and links into the inbox. |
| Comparison "Request clarification" dialog with a permanently disabled Send | Send stays impossible from the comparison; the dialog's action is "Review in Messages", which opens the draft the system prepared. |
| Dashboard "Review draft" action and the sidebar "Messages" item | Both are now destinations into the inbox. |
| Operator work queue's inline outbound approval | Unchanged; it shows the step after the buyer's approval (operator approves and sends). |

## 3. Rules in the helper (`messages-demo.ts`, 10 tests)

- **Outbound state** from the approval record: awaiting your approval → with the operator → sent; a return by the operator puts it back with the buyer.
- **Thread status** follows the latest non-system message: needs your approval, returned to you, with the operator, sent and awaiting reply, supplier replied, or notice.
- **Ordering:** threads that need the buyer first, then newest activity.
- **Approve** only while both approvals are open and both languages exist.
- **Compose** is blocked while a draft is open or with the operator, on closed sample threads, and on notices with no supplier.
- **Draft validation:** English required, 2,000 characters at most; a warning when the text looks like contact details (contacts move only under a recorded disclosure grant; the operator removes them).
- **Allowed channels:** platform message always; WeChat relay only where the CRM recorded a contact basis for the supplier; email is intake only.
- **Outbound log:** channel, both approvers with times, reference, for messages that actually left the system.

## 4. Layout

Header with counts (needs your approval, with the operator, awaiting reply) and the as-of date. Two panes from the large breakpoint; phones show the list, then the thread with a back control.

**Thread list:** status tabs All · Needs you · With operator · Awaiting reply · Replied with counts; project filter; each row has the subject, status chip, supplier and project, the latest message, kind and last activity.

**Thread:** subject, supplier, project, RFQ reference, kind, status; "Open project". Messages in order: system notes as dashed lines; outbound and inbound as cards with the author, direction badge, "Drafted by AI from your request" where true, time and channel. Inbound shows the Chinese first, then the translation; outbound shows the English first, then the Chinese. Every translation states who made it and who checked it. Inbound flags appear as notices: text addressed to the software found and ignored (recorded as a security event), contact details removed, links not opened. Attachments link to the document review. Each outbound message shows its approval chain; while a draft is open the buyer can Approve wording, Edit wording (the Chinese is re-drafted and both approvals reset) or Withdraw draft; sent messages show the channel, time, reference and both approvers.

**Composer:** English text, channel select limited to what the supplier's recorded contact basis allows with the reason stated, validation errors and the contact-details warning, "Submit for operator approval" which counts as the buyer's approval. Revalidation threads offer a one-click prefilled request.

**Evidence drawer:** supplier with the contact-confidentiality sentence, project, RFQ, allowed channels with the recorded basis date, who can see the thread, the outbound log, and the session's actions. On narrow screens the facts sit below the thread.

## 5. Verified in the browser

Atlas 1440: the tooling draft is listed first as needing approval; counts read 1 needs your approval, 1 awaiting reply; the chain shows You waiting, Operator and Sent pending; Edit wording re-drafts the Chinese and resets the chain; Approve wording marks You done with the time, moves the thread to "With the operator", drops the Needs-you count to 0 and logs the queue target; the Supplier A reply shows the contact-removed notice, the Chinese first, the relay note and the sent line with its reference; the composer warns on a phone number, offers platform and WeChat relay for Supplier A with the recorded basis date, and submission adds an outbound message with You done and Operator waiting over WeChat relay; the revalidation thread prefills the request and offers platform only; the Supplier K email shows both flags and links the attachment to its review; the sample thread is closed; the cartons filter shows the one sent thread; an unknown thread id falls back to the first thread; the overview Messages tab shows the shared threads with chains and links; the dashboard and sidebar link to the inbox. Obsidian 375: list then thread with a working back control, facts below the thread, no horizontal overflow including while editing and after submitting. The 320 and 768 checks could not be held in this session because the browser pane was being resized while they ran; the layout uses the same list, card and composer patterns verified at those widths on the documents and reports screens. No console errors from the preview itself.

## 6. Contract the UI assumes (handoff H-35)

`supplier_messages` rows with direction, channel, `body_en`, `body_zh`, `drafted_by_ai_run_id`, translation provenance (run id and the checking operator), an approval record (buyer approval by and at; operator approval or return by, at, note; `sent_at`, `sent_by`, `external_ref`); thread grouping by project, supplier and subject with status derived server-side; allowed channels from the supplier's recorded contact basis; inbound flags as data, with text addressed to the software recorded as a security event; attachments through the documents pipeline; buyer edit resets both approvals; withdraw deletes an unsent draft and logs it; the outbound log readable by the owning organization.

## 7. Not built

Operator-side thread view (the work queue covers approval and relay), supplier-side 消息 screen, read receipts, bulk approval, message search, notification preferences.
