"use client";

/**
 * Buyer workspace: Messages / Inbox (IA §2.1 "Messages → Inbox (approval stages visible)";
 * project route `/app/projects/[id]/messages`). Thread list with status filters, the thread with
 * every message in both languages and its translation provenance, the approval chain on every
 * outbound message with the buyer's approve / edit / withdraw, a composer that submits to the
 * operator queue, inbound flags, and the outbound log in the evidence drawer. Nothing is sent from
 * this screen: the operator's approval and the send happen server-side (PRD AC-B6.1, ADR-012).
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
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  Select,
  Tabs,
  TextArea,
  cx,
} from "../ui/primitives";

type Filter = "all" | "needs_you" | "operator" | "awaiting_reply" | "replied";

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
    setEditingId(null);
    setComposeText("");
    setComposeChannel("platform");
  };

  const rightRail = thread ? (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">
          Who sees this, and how it is sent
        </p>
      </div>
      <ThreadFacts thread={thread} />
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
    <AppShell workspace="buyer" title="Messages" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <div className={cx(view === "thread" && "hidden lg:block")}>
          <PageHeader
            title="Messages"
            lead="Every question to a supplier goes through two approvals: you approve the wording, an operator approves and sends it through a recorded channel. Supplier replies are relayed by the operator with the original Chinese and a checked translation."
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

        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          {/* Thread list */}
          <div className={cx("flex min-w-0 flex-col gap-3", view === "thread" && "hidden lg:flex")}>
            <Tabs
              label="Thread status"
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: "all", label: "All", count: countFor("all") },
                { value: "needs_you", label: "Needs you", count: countFor("needs_you") },
                { value: "operator", label: "With operator", count: countFor("operator") },
                {
                  value: "awaiting_reply",
                  label: "Awaiting reply",
                  count: countFor("awaiting_reply"),
                },
                { value: "replied", label: "Replied", count: countFor("replied") },
              ]}
            />
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
                    const last = t.messages[t.messages.length - 1];
                    const active = t.id === selectedId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => selectThread(t.id)}
                          aria-pressed={active}
                          className={cx(
                            "flex w-full min-w-0 flex-col gap-1 px-4 py-3 text-left hover:bg-(--fbg-bg-canvas)",
                            active && "bg-(--fbg-selected)",
                          )}
                        >
                          <span className="flex min-w-0 items-start justify-between gap-2">
                            <span className="min-w-0 text-sm font-medium text-(--fbg-text-primary)">
                              {t.subject}
                            </span>
                            <Badge tone={THREAD_STATUS_TONE[s]} icon={null}>
                              {THREAD_STATUS_LABEL[s]}
                            </Badge>
                          </span>
                          <span className="truncate text-xs text-(--fbg-text-secondary)">
                            {t.supplier?.name ?? "System"} · {t.projectName}
                          </span>
                          {last ? (
                            <span className="line-clamp-2 text-xs text-(--fbg-text-secondary)">
                              {last.en}
                            </span>
                          ) : null}
                          <span className="fbg-num text-[11px] text-(--fbg-text-secondary)">
                            {THREAD_KIND_LABEL[t.kind]} · {lastActivity(t)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* Thread */}
          <div className={cx("flex min-w-0 flex-col gap-4", view === "list" && "hidden lg:flex")}>
            {thread && status ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) text-(--fbg-text-secondary) lg:hidden"
                      aria-label="Back to threads"
                    >
                      <Icon name="chevron-right" size={16} className="rotate-180" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">
                        {thread.subject}
                      </h2>
                      <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                        {thread.supplier?.name ?? "System"} · {thread.projectName}
                        {thread.rfqRef ? ` · ${thread.rfqRef}` : ""} ·{" "}
                        {THREAD_KIND_LABEL[thread.kind]}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={THREAD_STATUS_TONE[status]} icon={null}>
                      {THREAD_STATUS_LABEL[status]}
                    </Badge>
                    <Link
                      href="/design-preview/buyer/project"
                      className={buttonClasses("ghost", "sm")}
                    >
                      Open project
                    </Link>
                  </div>
                </div>

                <ol className="flex flex-col gap-3" aria-label="Messages">
                  {thread.messages.map((m) => (
                    <li key={m.id}>
                      {m.direction === "system" ? (
                        <div className="flex items-start gap-2 rounded-(--fbg-radius-control) border border-dashed border-(--fbg-border-subtle) px-3 py-2 text-xs text-(--fbg-text-secondary)">
                          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                          <span>
                            <span className="fbg-num">{m.at}</span> · {m.en}
                          </span>
                        </div>
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
                    </li>
                  ))}
                </ol>

                <Composer
                  thread={thread}
                  text={composeText}
                  onText={setComposeText}
                  channel={composeChannel}
                  onChannel={setComposeChannel}
                  onSubmit={() => submitCompose(thread)}
                />

                <div className="xl:hidden">
                  <Panel title="Who sees this, and how it is sent">
                    <ThreadFacts thread={thread} />
                  </Panel>
                </div>
              </>
            ) : (
              <EmptyState
                title="Select a thread"
                body="Threads that need your approval are listed first."
                icon="message"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
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
        "rounded-(--fbg-radius-card) border bg-(--fbg-bg-surface) p-4",
        outbound
          ? "border-(--fbg-border-subtle) border-l-4 border-l-(--fbg-brand-accent)"
          : "border-(--fbg-border-subtle) border-l-4 border-l-(--fbg-action-primary)",
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
            <p className="fbg-zh text-sm text-(--fbg-text-primary)" lang="zh-CN">
              {m.zh}
            </p>
          ) : null}
          <p
            className={cx(
              "text-sm",
              zhFirst ? "text-(--fbg-text-secondary)" : "text-(--fbg-text-primary)",
            )}
          >
            {m.en}
          </p>
          {!zhFirst && m.zh ? (
            <p className="fbg-zh text-sm text-(--fbg-text-secondary)" lang="zh-CN">
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

  return (
    <Panel
      title={`Ask ${thread.supplier?.name ?? "the supplier"}`}
      description="Write in English. The Chinese is drafted from it and checked by the operator, who approves and sends through the recorded channel."
    >
      {!open ? (
        <p className="text-sm text-(--fbg-text-secondary)">{blockedReason}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {thread.kind === "revalidation" && text.length === 0 ? (
            <div>
              <Button size="sm" icon="clock" onClick={() => onText(REVALIDATION_PREFILL)}>
                Ask for revalidation
              </Button>
            </div>
          ) : null}
          <TextArea
            aria-label="Your question in English"
            rows={3}
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder="For example: does the unit price include the plate fee, and until what date is it valid?"
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              aria-label="Channel"
              value={channel}
              onChange={(e) => onChannel(e.target.value as Channel)}
              className="sm:w-80"
            >
              {allowed.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </Select>
            <span className="text-xs text-(--fbg-text-secondary)">
              {allowed.includes("wechat_relay")
                ? `WeChat relay is available: a contact basis was recorded on ${thread.supplier?.wechatConsentRecordedAt}.`
                : "Platform message only: no WeChat contact basis is recorded for this supplier."}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon="message" disabled={!validation.ok} onClick={onSubmit}>
              Submit for operator approval
            </Button>
            <span className="text-xs text-(--fbg-text-secondary)">
              Counts as your approval of the wording. The operator approves and sends.
            </span>
          </div>
        </div>
      )}
    </Panel>
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
