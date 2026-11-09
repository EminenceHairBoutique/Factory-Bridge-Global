"use client";

/**
 * Buyer workspace: Messages / Inbox (IA §2.1 "Messages → Inbox (approval stages visible)";
 * project route `/app/projects/[id]/messages`). Conversation-first (UX-04): a compact thread list,
 * a spacious conversation with the approval requirement pinned above it, a sticky composer, and
 * the supplier, evidence and approval history in an on-demand drawer. Every outbound message
 * still shows its chain You → Operator → Sent and the buyer's approve / edit / withdraw. Nothing
 * is sent from this screen: the operator's approval and the send happen server-side
 * (PRD AC-B6.1, ADR-012).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_AS_OF, DEMO_PROJECTS } from "../demo-data";
import {
  CHANNEL_LABEL,
  CHANNEL_SHORT,
  DEMO_THREADS,
  INBOUND_FLAG_LABEL,
  THREAD_KIND_LABEL,
  type Channel,
  type Thread,
  type ThreadMessage,
} from "../demo-data/messages";
import {
  THREAD_STATUS_LABEL,
  THREAD_STATUS_TONE,
  allowedChannels,
  approvalChain,
  canApprove,
  canCompose,
  inboxSummary,
  lastActivity,
  outboundLog,
  outboundState,
  sortThreads,
  threadStatus,
  validateDraft,
  type ThreadStatus,
} from "../messages-demo";
import { ApprovalChainChips } from "../ui/ApprovalChain";
import { AppShell } from "../ui/AppShell";
import { ConversationShell, DOT_CLASS, ThreadRow } from "../ui/ConversationShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextArea,
  cx,
} from "../ui/primitives";

type Filter = "all" | "needs_you" | "operator" | "awaiting_reply" | "replied";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All threads",
  needs_you: "Needs you",
  operator: "With the operator",
  awaiting_reply: "Awaiting reply",
  replied: "Supplier replied",
};

const FILTER_MATCH: Record<Filter, (s: ThreadStatus) => boolean> = {
  all: () => true,
  needs_you: (s) => s === "awaiting_your_approval" || s === "returned_to_you",
  operator: (s) => s === "awaiting_operator",
  awaiting_reply: (s) => s === "awaiting_reply",
  replied: (s) => s === "replied",
};

const REVALIDATION_PREFILL =
  "Your quotation of 2026-10-09 expired on 2026-10-31. Could you confirm whether the same prices and terms still apply, and until what date?";

const ZH_PENDING = "（中文由系统起草，操作员核对后发送。）";
const ZH_REDRAFT = "（中文将根据您修改后的内容重新起草，并由操作员核对。）";

function now(): string {
  return `${DEMO_AS_OF} ${new Date().toISOString().slice(11, 16)}`;
}

export function BuyerMessages({ initialThreadId }: { initialThreadId?: string | undefined }) {
  const [threads, setThreads] = useState<Thread[]>(DEMO_THREADS);
  const [filter, setFilter] = useState<Filter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThreadId && DEMO_THREADS.some((t) => t.id === initialThreadId)
      ? initialThreadId
      : (sortThreads(DEMO_THREADS)[0]?.id ?? null),
  );
  const [view, setView] = useState<"list" | "thread">(initialThreadId ? "thread" : "list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [composeText, setComposeText] = useState("");
  const [composeChannel, setComposeChannel] = useState<Channel>("platform");
  const [log, setLog] = useState<string[]>([]);

  const summary = useMemo(() => inboxSummary(threads), [threads]);
  const rows = useMemo(
    () =>
      sortThreads(threads).filter(
        (t) =>
          (projectFilter === "all" || t.projectId === projectFilter) &&
          FILTER_MATCH[filter](threadStatus(t)),
      ),
    [threads, filter, projectFilter],
  );
  const countFor = (f: Filter) => threads.filter((t) => FILTER_MATCH[f](threadStatus(t))).length;

  const thread = threads.find((t) => t.id === selectedId) ?? null;
  const status = thread ? threadStatus(thread) : null;
  const openDraft = thread
    ? [...thread.messages]
        .reverse()
        .find((m) => m.direction === "outbound" && outboundState(m) !== "sent")
    : undefined;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const updateMessage = (
    threadId: string,
    messageId: string,
    fn: (m: ThreadMessage) => ThreadMessage,
  ) =>
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, messages: t.messages.map((m) => (m.id === messageId ? fn(m) : m)) }
          : t,
      ),
    );

  const approve = (t: Thread, m: ThreadMessage) => {
    if (!canApprove(m)) return;
    const at = now();
    updateMessage(t.id, m.id, (x) =>
      x.approval
        ? { ...x, approval: { ...x.approval, buyer: { state: "done", by: "You", at, note: null } } }
        : x,
    );
    note(`Approved wording of “${t.subject}”; now in the operator queue (target 8 h)`);
  };

  const startEdit = (m: ThreadMessage) => {
    setEditingId(m.id);
    setEditText(m.en);
    document.getElementById(`msg-${m.id}`)?.scrollIntoView({ block: "center" });
  };

  const saveEdit = (t: Thread, m: ThreadMessage) => {
    const v = validateDraft(editText);
    if (!v.ok) return;
    updateMessage(t.id, m.id, (x) => ({
      ...x,
      en: editText.trim(),
      zh: ZH_REDRAFT,
      translation: {
        by: "ai",
        checkedBy: null,
        note: "Re-drafted from your edited wording; the operator checks it before sending.",
      },
      approval: x.approval
        ? {
            ...x.approval,
            buyer: { state: "pending", by: null, at: null, note: null },
            operator: { state: "pending", by: null, at: null, note: null },
          }
        : x.approval,
    }));
    setEditingId(null);
    note(`Edited the wording of “${t.subject}”; approvals reset`);
  };

  const withdraw = (t: Thread, m: ThreadMessage) => {
    setThreads((prev) =>
      prev.map((x) =>
        x.id === t.id ? { ...x, messages: x.messages.filter((y) => y.id !== m.id) } : x,
      ),
    );
    setEditingId(null);
    note(`Withdrew the draft in “${t.subject}”; nothing was sent`);
  };

  const submitCompose = (t: Thread) => {
    const v = validateDraft(composeText);
    if (!v.ok || !canCompose(t)) return;
    const at = now();
    const m: ThreadMessage = {
      id: `m_${Date.now()}`,
      direction: "outbound",
      author: "You",
      actingAs: "buyer",
      at,
      en: composeText.trim(),
      zh: ZH_PENDING,
      translation: {
        by: "ai",
        checkedBy: null,
        note: "Chinese is drafted from your English and checked by the operator before sending.",
      },
      channel: composeChannel,
      approval: {
        buyer: { state: "done", by: "You", at, note: null },
        operator: { state: "pending", by: null, at: null, note: null },
        sent: { at: null, channel: null, externalRef: null },
      },
      attachments: [],
      flags: [],
      draftedByAi: false,
    };
    setThreads((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, messages: [...x.messages, m] } : x)),
    );
    setComposeText("");
    note(
      `Submitted a question to ${t.supplier?.name ?? "the supplier"} via ${CHANNEL_SHORT[composeChannel]}; waiting for the operator`,
    );
  };

  const selectThread = (id: string) => {
    setSelectedId(id);
    setView("thread");
    setDrawerOpen(false);
    setEditingId(null);
    setComposeText("");
    setComposeChannel("platform");
  };

  const list = (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Select
          aria-label="Filter by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
            <option key={f} value={f}>
              {FILTER_LABEL[f]} ({countFor(f)})
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">All projects</option>
          {DEMO_PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <Panel padded={false}>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No threads match"
              body="Change the filters. New questions start from a quotation in the comparison or from a thread with that supplier."
              icon="message"
            />
          </div>
        ) : (
          <ul className="divide-y divide-(--fbg-border-subtle)">
            {rows.map((t) => {
              const s = threadStatus(t);
              return (
                <li key={t.id}>
                  <ThreadRow
                    active={t.id === selectedId}
                    dotClass={DOT_CLASS[THREAD_STATUS_TONE[s]]}
                    subject={t.subject}
                    meta={`${t.supplier?.name ?? "System"} · ${t.projectName}`}
                    statusLabel={THREAD_STATUS_LABEL[s]}
                    time={lastActivity(t).slice(5)}
                    onSelect={() => selectThread(t.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );

  const header = thread ? (
    <div className="min-w-0">
      <h2 className="truncate text-[17px] font-semibold text-(--fbg-text-primary)">
        {thread.subject}
      </h2>
      <p className="fbg-num truncate text-xs text-(--fbg-text-secondary)">
        {thread.supplier?.name ?? "System"} · {thread.projectName}
        {thread.rfqRef ? ` · ${thread.rfqRef}` : ""} · {THREAD_KIND_LABEL[thread.kind]}
        {status ? ` · ${THREAD_STATUS_LABEL[status]}` : ""}
      </p>
    </div>
  ) : null;

  const strip =
    thread && status && openDraft ? (
      <ApprovalStrip
        status={status}
        draft={openDraft}
        onApprove={() => approve(thread, openDraft)}
        onEdit={() => startEdit(openDraft)}
      />
    ) : null;

  const conversation = thread
    ? thread.messages.map((m) => (
        <div key={m.id} id={`msg-${m.id}`}>
          {m.direction === "system" ? (
            <p className="mx-auto max-w-[72ch] px-3 text-center text-xs text-(--fbg-text-secondary)">
              <span className="fbg-num">{m.at}</span> · {m.en}
            </p>
          ) : (
            <MessageCard
              thread={thread}
              m={m}
              editing={editingId === m.id}
              editText={editText}
              onEditText={setEditText}
              onApprove={() => approve(thread, m)}
              onStartEdit={() => startEdit(m)}
              onSaveEdit={() => saveEdit(thread, m)}
              onCancelEdit={() => setEditingId(null)}
              onWithdraw={() => withdraw(thread, m)}
            />
          )}
        </div>
      ))
    : null;

  const composer = thread ? (
    <Composer
      thread={thread}
      text={composeText}
      onText={setComposeText}
      channel={composeChannel}
      onChannel={setComposeChannel}
      onSubmit={() => submitCompose(thread)}
    />
  ) : null;

  const drawer = thread ? (
    <div className="flex flex-col gap-5">
      <ThreadFacts thread={thread} />
      <ApprovalHistory thread={thread} />
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Actions this session</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            Nothing yet. Approvals, edits and submissions are written to the audit trail with your
            name.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
            {log.map((l, i) => (
              <li key={`${l}-${i}`} className="fbg-num">
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  return (
    <AppShell workspace="buyer" title="Messages">
      <div className="flex flex-col gap-4">
        <div className={cx(view === "thread" && "hidden lg:block")}>
          <PageHeader
            title="Messages"
            lead="You approve the wording; an operator approves and sends through a recorded channel. Replies come back with the original Chinese and a checked translation."
            meta={
              <>
                <Badge
                  tone={summary.needsYou > 0 ? "warn" : "ok"}
                  icon={summary.needsYou > 0 ? "alert" : "check"}
                  className="fbg-num"
                >
                  {summary.needsYou} need{summary.needsYou === 1 ? "s" : ""} your approval
                </Badge>
                <Badge tone="teal" icon={null} className="fbg-num">
                  {summary.awaitingOperator} with the operator
                </Badge>
                <Badge tone="neutral" icon={null} className="fbg-num">
                  {summary.awaitingReply} awaiting reply
                </Badge>
                <Badge tone="neutral" icon="clock" className="fbg-num">
                  As of {DEMO_AS_OF}
                </Badge>
              </>
            }
          />
        </div>

        <ConversationShell
          list={list}
          header={header}
          strip={strip}
          conversation={conversation}
          composer={composer}
          drawer={drawer}
          drawerTitle="Thread details"
          drawerOpen={drawerOpen}
          onDrawerOpenChange={setDrawerOpen}
          view={view}
          onBack={() => setView("list")}
          labels={{
            back: "Back to threads",
            details: "Details",
            close: "Close details",
            list: "Threads",
            conversation: "Conversation",
          }}
          empty={
            thread ? undefined : (
              <EmptyState
                title="Select a thread"
                body="Threads that need your approval are listed first."
                icon="message"
              />
            )
          }
        />
      </div>
    </AppShell>
  );
}

function ApprovalStrip({
  status,
  draft,
  onApprove,
  onEdit,
}: {
  status: ThreadStatus;
  draft: ThreadMessage;
  onApprove: () => void;
  onEdit: () => void;
}) {
  if (status === "awaiting_your_approval")
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 rounded-(--fbg-radius-control) border border-(--fbg-status-warning)/40 bg-(--fbg-status-warning-fill) px-3 py-2 text-sm text-(--fbg-text-primary)"
      >
        <Icon name="alert" size={16} className="shrink-0 text-(--fbg-status-warning)" />
        <span className="min-w-0 flex-1">
          Your approval of the wording is needed before an operator can send this.
        </span>
        <Button
          size="sm"
          variant="primary"
          icon="check"
          disabled={!canApprove(draft)}
          onClick={onApprove}
        >
          Approve wording
        </Button>
        <Button size="sm" onClick={onEdit}>
          Edit wording
        </Button>
      </div>
    );
  if (status === "returned_to_you")
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 rounded-(--fbg-radius-control) border border-(--fbg-status-danger)/40 bg-(--fbg-status-danger-fill) px-3 py-2 text-sm text-(--fbg-text-primary)"
      >
        <Icon name="alert" size={16} className="shrink-0 text-(--fbg-status-danger)" />
        <span className="min-w-0 flex-1">
          The operator returned this draft
          {draft.approval?.operator.note ? `: ${draft.approval.operator.note}` : ""}. Edit the
          wording and approve it again.
        </span>
        <Button size="sm" variant="primary" onClick={onEdit}>
          Edit wording
        </Button>
      </div>
    );
  if (status === "awaiting_operator")
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 rounded-(--fbg-radius-control) border border-(--fbg-action-primary)/30 bg-(--fbg-selected) px-3 py-2 text-sm text-(--fbg-text-primary)"
      >
        <Icon name="clock" size={16} className="shrink-0 text-(--fbg-action-primary)" />
        <span className="min-w-0 flex-1">
          With the operator: they approve the wording and send it through the recorded channel.
          Nothing else is needed from you.
        </span>
      </div>
    );
  return null;
}

function MessageCard({
  thread,
  m,
  editing,
  editText,
  onEditText,
  onApprove,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onWithdraw,
}: {
  thread: Thread;
  m: ThreadMessage;
  editing: boolean;
  editText: string;
  onEditText: (v: string) => void;
  onApprove: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onWithdraw: () => void;
}) {
  const outbound = m.direction === "outbound";
  const state = outbound ? outboundState(m) : null;
  const chain = m.approval ? approvalChain(m.approval, m.channel) : [];
  const validation = editing ? validateDraft(editText) : null;
  const zhFirst = m.direction === "inbound";

  return (
    <article
      className={cx(
        "w-full max-w-[72ch] rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) border-l-4 bg-(--fbg-bg-surface) p-4",
        outbound
          ? "ml-auto border-l-(--fbg-brand-accent)"
          : "mr-auto border-l-(--fbg-action-primary)",
      )}
      aria-label={`${outbound ? "Outbound" : "Inbound"} message from ${m.author}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-(--fbg-text-primary)">{m.author}</span>
          <Badge tone={outbound ? "brand" : "teal"} icon={null}>
            {outbound ? "To the supplier" : "From the supplier"}
          </Badge>
          {m.draftedByAi ? (
            <Badge tone="neutral" icon={null}>
              Drafted by AI from your request
            </Badge>
          ) : null}
        </div>
        <span className="fbg-num text-xs text-(--fbg-text-secondary)">
          {m.at} · {CHANNEL_LABEL[m.channel]}
        </span>
      </header>

      {m.flags.map((f) => (
        <div key={f} className="mt-3">
          <Notice
            tone={f === "embedded_instruction_detected" ? "danger" : "warn"}
            title={INBOUND_FLAG_LABEL[f].label}
          >
            {INBOUND_FLAG_LABEL[f].body}
          </Notice>
        </div>
      ))}

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextArea
            aria-label="Edit the English wording"
            rows={4}
            value={editText}
            onChange={(e) => onEditText(e.target.value)}
          />
          {validation?.errors.map((e) => (
            <p key={e} className="text-xs text-(--fbg-status-danger)">
              {e}
            </p>
          ))}
          {validation?.warnings.map((w) => (
            <p key={w} className="text-xs text-(--fbg-status-warning)">
              {w}
            </p>
          ))}
          <p className="text-xs text-(--fbg-text-secondary)">
            The Chinese is re-drafted from your new wording and checked by the operator; both
            approvals start again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={!validation?.ok} onClick={onSaveEdit}>
              Save wording
            </Button>
            <Button size="sm" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {zhFirst && m.zh ? (
            <p className="fbg-zh text-[15px] leading-7 text-(--fbg-text-primary)" lang="zh-CN">
              {m.zh}
            </p>
          ) : null}
          <p
            className={cx(
              "leading-7",
              zhFirst
                ? "text-sm text-(--fbg-text-secondary)"
                : "text-[15px] text-(--fbg-text-primary)",
            )}
          >
            {m.en}
          </p>
          {!zhFirst && m.zh ? (
            <p className="fbg-zh text-sm leading-7 text-(--fbg-text-secondary)" lang="zh-CN">
              {m.zh}
            </p>
          ) : null}
          {m.translation ? (
            <p className="text-xs text-(--fbg-text-secondary)">
              {m.translation.note ??
                (m.translation.by === "ai"
                  ? `Translated by AI${m.translation.checkedBy ? `, checked by ${m.translation.checkedBy}` : ", not yet checked"}.`
                  : `Translated by ${m.translation.checkedBy ?? "the operator"}.`)}
            </p>
          ) : null}
        </div>
      )}

      {m.attachments.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {m.attachments.map((a) => (
            <li key={a.documentId}>
              <Link
                href={`/design-preview/buyer/review?doc=${a.documentId}`}
                className="fbg-num inline-flex items-center gap-1 rounded-(--fbg-radius-chip) border border-(--fbg-border-subtle) px-2 py-1 text-xs text-(--fbg-text-link) hover:underline"
              >
                <Icon name="document" size={12} /> {a.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {chain.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          <ApprovalChainChips steps={chain} />
          {m.approval?.operator.state === "returned" && m.approval.operator.note ? (
            <Notice tone="warn" title="Returned by the operator">
              {m.approval.operator.note}
            </Notice>
          ) : null}
        </div>
      ) : null}

      {outbound && state !== "sent" && !editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canApprove(m) ? (
            <Button size="sm" variant="primary" icon="check" onClick={onApprove}>
              Approve wording
            </Button>
          ) : null}
          <Button size="sm" onClick={onStartEdit}>
            Edit wording
          </Button>
          <Button size="sm" variant="ghost" onClick={onWithdraw}>
            Withdraw draft
          </Button>
          <span className="text-xs text-(--fbg-text-secondary)">
            {state === "awaiting_operator"
              ? "An operator approves and sends it; you will see the channel and time here."
              : "Nothing is sent until you and an operator approve."}
          </span>
        </div>
      ) : null}
      {state === "sent" && m.approval?.sent.externalRef ? (
        <p className="fbg-num mt-2 text-xs text-(--fbg-text-secondary)">
          Sent via {CHANNEL_SHORT[m.approval.sent.channel ?? m.channel]} · {m.approval.sent.at} ·
          ref {m.approval.sent.externalRef} · approved by {m.approval.buyer.by} and{" "}
          {m.approval.operator.by}
        </p>
      ) : null}
      {thread.kind === "rfq" && m.direction === "inbound" ? (
        <p className="mt-2 text-xs text-(--fbg-text-secondary)">
          The quotation itself is read in extraction review, not from this message.
        </p>
      ) : null}
    </article>
  );
}

function Composer({
  thread,
  text,
  onText,
  channel,
  onChannel,
  onSubmit,
}: {
  thread: Thread;
  text: string;
  onText: (v: string) => void;
  channel: Channel;
  onChannel: (c: Channel) => void;
  onSubmit: () => void;
}) {
  const allowed = allowedChannels(thread.supplier);
  const open = canCompose(thread);
  const validation = validateDraft(text);
  const lastOutbound = [...thread.messages].reverse().find((m) => m.direction === "outbound");
  const blockedReason = !thread.supplier
    ? "This notice has no supplier to write to."
    : thread.kind === "sample"
      ? "This sample thread is closed. Ask anything new in a fresh thread from the comparison."
      : lastOutbound && outboundState(lastOutbound) === "awaiting_operator"
        ? "Your previous message is with the operator. You can write again once it has been sent."
        : lastOutbound && outboundState(lastOutbound) !== "sent"
          ? "Approve or withdraw the open draft before writing another message."
          : null;

  if (!open) return <p className="text-xs text-(--fbg-text-secondary)">{blockedReason}</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-(--fbg-text-primary)">
          Ask {thread.supplier?.name ?? "the supplier"}
        </p>
        {thread.kind === "revalidation" && text.length === 0 ? (
          <Button
            size="sm"
            variant="ghost"
            icon="clock"
            onClick={() => onText(REVALIDATION_PREFILL)}
          >
            Ask for revalidation
          </Button>
        ) : null}
      </div>
      <TextArea
        id="buyer-compose"
        aria-label="Your question in English"
        rows={2}
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Write in English. The Chinese is drafted from it and checked by the operator."
      />
      {text.length > 0
        ? validation.errors.map((e) => (
            <p key={e} className="text-xs text-(--fbg-status-danger)">
              {e}
            </p>
          ))
        : null}
      {validation.warnings.map((w) => (
        <p key={w} className="text-xs text-(--fbg-status-warning)">
          {w}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Channel"
          value={channel}
          onChange={(e) => onChannel(e.target.value as Channel)}
          className="min-w-0 sm:w-72"
        >
          {allowed.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </Select>
        <Button variant="primary" icon="message" disabled={!validation.ok} onClick={onSubmit}>
          Submit for operator approval
        </Button>
        <span className="text-xs text-(--fbg-text-secondary)">
          {allowed.includes("wechat_relay")
            ? `WeChat relay available: contact basis recorded ${thread.supplier?.wechatConsentRecordedAt}.`
            : "Platform message only: no WeChat contact basis recorded."}{" "}
          Counts as your approval; the operator approves and sends.
        </span>
      </div>
    </div>
  );
}

function ThreadFacts({ thread }: { thread: Thread }) {
  const allowed = allowedChannels(thread.supplier);
  const rows = outboundLog(thread);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <KeyValue
        columns={1}
        items={[
          {
            label: "Supplier",
            value: thread.supplier ? (
              <span>
                {thread.supplier.name}
                <span className="block text-xs text-(--fbg-text-secondary)">
                  Contact details are held by the operator and shown to you only under a recorded
                  disclosure grant.
                </span>
              </span>
            ) : (
              "None (system notice)"
            ),
          },
          { label: "Project", value: thread.projectName },
          ...(thread.rfqRef
            ? [{ label: "RFQ", value: <span className="fbg-num">{thread.rfqRef}</span> }]
            : []),
          {
            label: "Channels",
            value:
              allowed.length === 0
                ? "No outbound channel"
                : allowed.map((c) => CHANNEL_LABEL[c]).join("; ") +
                  (allowed.includes("wechat_relay")
                    ? ` (contact basis recorded ${thread.supplier?.wechatConsentRecordedAt})`
                    : " (no WeChat contact basis recorded)"),
          },
          {
            label: "Who can see it",
            value:
              "Your organization and the operators assigned to the project. The supplier sees only messages that were sent to it, in its own portal.",
          },
        ]}
      />
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Outbound log</p>
        {rows.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">Nothing has been sent yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1.5">
            {rows.map((r) => (
              <li key={r.messageId} className="fbg-num text-xs text-(--fbg-text-secondary)">
                {r.at} · {CHANNEL_SHORT[r.channel]} · approved {r.buyerApprovedBy}{" "}
                {r.buyerApprovedAt}; {r.operatorApprovedBy} {r.operatorApprovedAt}
                {r.externalRef ? ` · ref ${r.externalRef}` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Every sent message records channel, both approvers, time and the exact text.
        </p>
      </div>
    </div>
  );
}

function ApprovalHistory({ thread }: { thread: Thread }) {
  const outbound = thread.messages.filter((m) => m.direction === "outbound" && m.approval);
  return (
    <div>
      <p className="text-xs font-semibold text-(--fbg-text-primary)">Approval history</p>
      {outbound.length === 0 ? (
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          No outbound message in this thread yet.
        </p>
      ) : (
        <ol className="mt-2 flex flex-col gap-3">
          {outbound.map((m) => (
            <li key={m.id} className="flex flex-col gap-1.5">
              <p className="line-clamp-2 text-xs text-(--fbg-text-primary)">{m.en}</p>
              {m.approval ? (
                <ApprovalChainChips steps={approvalChain(m.approval, m.channel)} />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
