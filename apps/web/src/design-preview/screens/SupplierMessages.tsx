"use client";

/**
 * 供应商工作台：消息 (IA `/supplier/messages`). Conversation-first (UX-04): a compact thread list, a
 * spacious conversation with the status requirement pinned above it, a sticky reply composer, and
 * the buyer, channel, visibility and relay history in an on-demand drawer. Buyer identity is an
 * anonymized label; contact details never appear. Local state only; nothing is sent.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SM_KIND_LABEL,
  SUPPLIER_MESSAGES_TODAY,
  SUPPLIER_THREADS,
  type SmAttachment,
  type SmMessage,
  type SmThread,
} from "../demo-data/supplier-messages";
import { validateUploads } from "../documents-demo";
import {
  SM_STATUS_HINT,
  SM_STATUS_TONE,
  UPLOAD_REASON_ZH,
  canReply,
  relayLog,
  smLastActivity,
  smSummary,
  smThreadStatus,
  sortSmThreads,
  validateReplyZh,
  type SmStatus,
} from "../supplier-messages-demo";
import { AppShell } from "../ui/AppShell";
import { ConversationShell, DOT_CLASS, ThreadRow } from "../ui/ConversationShell";
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
  TextArea,
  cx,
} from "../ui/primitives";

type Filter = "全部" | "待回复" | "已转达" | "已完成" | "通知";

const FILTERS: Filter[] = ["全部", "待回复", "已转达", "已完成", "通知"];

const FILTER_MATCH: Record<Filter, (s: SmStatus) => boolean> = {
  全部: () => true,
  待回复: (s) => s === "待回复" || s === "待转达",
  已转达: (s) => s === "已转达",
  已完成: (s) => s === "已完成",
  通知: (s) => s === "通知",
};

const SIMULATED_RELAY_MS = 1500;

function now(): string {
  return `${SUPPLIER_MESSAGES_TODAY} ${new Date().toISOString().slice(11, 16)}`;
}

export function SupplierMessages({ initialThreadId }: { initialThreadId?: string | undefined }) {
  const [threads, setThreads] = useState<SmThread[]>(SUPPLIER_THREADS);
  const [filter, setFilter] = useState<Filter>("全部");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThreadId && SUPPLIER_THREADS.some((t) => t.id === initialThreadId)
      ? initialThreadId
      : (sortSmThreads(SUPPLIER_THREADS)[0]?.id ?? null),
  );
  const [view, setView] = useState<"list" | "thread">(initialThreadId ? "thread" : "list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [attachments, setAttachments] = useState<SmAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const timers = useRef<Set<number>>(new Set());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  // Opening a thread marks it read.
  useEffect(() => {
    if (!selectedId) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === selectedId && t.unread ? { ...t, unread: false } : t)),
    );
  }, [selectedId]);

  const summary = useMemo(() => smSummary(threads), [threads]);
  const rows = useMemo(
    () => sortSmThreads(threads).filter((t) => FILTER_MATCH[filter](smThreadStatus(t))),
    [threads, filter],
  );
  const countFor = (f: Filter) => threads.filter((t) => FILTER_MATCH[f](smThreadStatus(t))).length;
  const thread = threads.find((t) => t.id === selectedId) ?? null;
  const status = thread ? smThreadStatus(thread) : null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const selectThread = (id: string) => {
    setSelectedId(id);
    setView("thread");
    setDrawerOpen(false);
    setReplyText("");
    setAttachments([]);
    setFileError(null);
  };

  const addFiles = (files: File[]) => {
    const result = validateUploads(files);
    setFileError(
      result.rejected.length
        ? result.rejected
            .map((r) => `${r.name}：${UPLOAD_REASON_ZH[r.reason] ?? r.reason}`)
            .join("；")
        : null,
    );
    if (result.accepted.length)
      setAttachments((prev) => [
        ...prev,
        ...result.accepted.map((f) => ({ name: f.name, status: "待扫描" as const })),
      ]);
  };

  const submitReply = (t: SmThread) => {
    const v = validateReplyZh(replyText);
    if (!v.ok || !canReply(t)) return;
    const at = now();
    const m: SmMessage = {
      id: `sm_${Date.now()}`,
      direction: "我方",
      at,
      zh: replyText.trim(),
      en: null,
      translationNote: "英文由平台翻译，运营核对后转达。",
      relayedAt: null,
      attachments,
      notice: null,
    };
    setThreads((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, messages: [...x.messages, m] } : x)),
    );
    setReplyText("");
    setAttachments([]);
    note(`已提交回复（${t.subject}），待平台转达`);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      const relayedAt = now();
      setThreads((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? {
                ...x,
                messages: x.messages.map((y) =>
                  y.id === m.id
                    ? {
                        ...y,
                        relayedAt,
                        attachments: y.attachments.map((a) => ({
                          ...a,
                          status: "审核中" as const,
                        })),
                      }
                    : y,
                ),
              }
            : x,
        ),
      );
      note(`平台已转达回复（模拟）${t.rfqRef ? `；询价单 ${t.rfqRef} 状态更新为“待回复”` : ""}`);
    }, SIMULATED_RELAY_MS);
    timers.current.add(timer);
  };

  const list = (
    <div className="flex flex-col gap-2">
      <Select
        aria-label="消息状态筛选"
        value={filter}
        onChange={(e) => setFilter(e.target.value as Filter)}
      >
        {FILTERS.map((f) => (
          <option key={f} value={f}>
            {f}（{countFor(f)}）
          </option>
        ))}
      </Select>
      <Panel padded={false}>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title="没有符合条件的消息" body="请调整筛选条件。" icon="message" />
          </div>
        ) : (
          <ul className="divide-y divide-(--fbg-border-subtle)">
            {rows.map((t) => {
              const s = smThreadStatus(t);
              return (
                <li key={t.id}>
                  <ThreadRow
                    active={t.id === selectedId}
                    unread={t.unread}
                    dotClass={t.unread ? "bg-(--fbg-brand-accent)" : DOT_CLASS[SM_STATUS_TONE[s]]}
                    subject={t.subject}
                    meta={`${t.buyerLabel}${t.rfqRef ? ` · ${t.rfqRef}` : ""}`}
                    statusLabel={s}
                    time={smLastActivity(t).slice(5)}
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
        {thread.buyerLabel}
        {thread.rfqRef ? ` · ${thread.rfqRef}` : ""} · {SM_KIND_LABEL[thread.kind]}
        {status ? ` · ${status}` : ""}
      </p>
    </div>
  ) : null;

  const strip =
    thread && status ? (
      <div
        role="status"
        className={cx(
          "flex flex-wrap items-center gap-2 rounded-(--fbg-radius-control) border px-3 py-2 text-sm text-(--fbg-text-primary)",
          status === "待回复"
            ? "border-(--fbg-status-warning)/40 bg-(--fbg-status-warning-fill)"
            : status === "待转达"
              ? "border-(--fbg-action-primary)/30 bg-(--fbg-selected)"
              : "border-(--fbg-border-subtle) bg-(--fbg-bg-surface)",
        )}
      >
        <Badge tone={SM_STATUS_TONE[status]} icon={null}>
          {status}
        </Badge>
        <span className="min-w-0 flex-1">{SM_STATUS_HINT[status]}</span>
        {status === "待回复" ? (
          <Button
            size="sm"
            variant="primary"
            icon="message"
            onClick={() => document.getElementById("sm-reply")?.focus()}
          >
            回复
          </Button>
        ) : null}
        {thread.rfqId ? (
          <Link
            href={`/design-preview/supplier/rfqs?rfq=${thread.rfqId}`}
            className={buttonClasses("ghost", "sm")}
          >
            查看询价单
          </Link>
        ) : null}
        {thread.link ? (
          <Link href={thread.link.href} className={buttonClasses("secondary", "sm")}>
            {thread.link.label}
          </Link>
        ) : null}
      </div>
    ) : null;

  const conversation = thread
    ? thread.messages.map((m) => (
        <div key={m.id}>
          {m.direction === "平台" ? (
            <p className="mx-auto max-w-[72ch] px-3 text-center text-xs text-(--fbg-text-secondary)">
              <span className="fbg-num">{m.at}</span> · 平台 · {m.zh}
            </p>
          ) : (
            <MessageCard m={m} />
          )}
        </div>
      ))
    : null;

  const composer = thread ? (
    <Composer
      thread={thread}
      text={replyText}
      onText={setReplyText}
      attachments={attachments}
      onFiles={addFiles}
      onRemoveAttachment={(name) => setAttachments((prev) => prev.filter((a) => a.name !== name))}
      fileError={fileError}
      onSubmit={() => submitReply(thread)}
    />
  ) : null;

  const drawer = thread ? (
    <div className="flex flex-col gap-5">
      <ThreadFacts thread={thread} />
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">本次操作记录</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            暂无。回复与附件提交均以您的账号记录在审计日志中。
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
    <AppShell workspace="supplier" title="消息">
      <div className="flex flex-col gap-4">
        <div className={cx(view === "thread" && "hidden lg:block")}>
          <PageHeader
            title="消息"
            lead="买家的问题由平台翻译并转达；您的回复经平台运营核对后转达买家。买家公司名称与联系方式在授权前不向您展示。"
            meta={
              <>
                <Badge
                  tone={summary.pendingReply > 0 ? "warn" : "ok"}
                  icon={summary.pendingReply > 0 ? "alert" : "check"}
                  className="fbg-num"
                >
                  {summary.pendingReply} 条待回复
                </Badge>
                <Badge tone="teal" icon={null} className="fbg-num">
                  {summary.pendingRelay} 条待转达
                </Badge>
                <Badge tone="neutral" icon={null} className="fbg-num">
                  {summary.unread} 条未读
                </Badge>
                <Badge tone="neutral" icon="clock" className="fbg-num">
                  截至 {SUPPLIER_MESSAGES_TODAY}
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
          drawerTitle="会话详情"
          drawerOpen={drawerOpen}
          onDrawerOpenChange={setDrawerOpen}
          view={view}
          onBack={() => setView("list")}
          labels={{
            back: "返回消息列表",
            details: "详情",
            close: "关闭详情",
            list: "消息列表",
            conversation: "会话",
          }}
          empty={
            thread ? undefined : (
              <EmptyState title="请选择一条消息" body="待回复的消息排在最前。" icon="message" />
            )
          }
        />
      </div>
    </AppShell>
  );
}

function MessageCard({ m }: { m: SmMessage }) {
  const mine = m.direction === "我方";
  return (
    <article
      className={cx(
        "w-full max-w-[72ch] rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) border-l-4 bg-(--fbg-bg-surface) p-4",
        mine ? "ml-auto border-l-(--fbg-brand-accent)" : "mr-auto border-l-(--fbg-action-primary)",
      )}
      aria-label={mine ? "我方回复" : "买家消息"}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-(--fbg-text-primary)">
            {mine ? "我方" : "买家（经平台转达）"}
          </span>
          {mine ? (
            <Badge tone={m.relayedAt ? "ok" : "teal"} icon={m.relayedAt ? "check" : "clock"}>
              {m.relayedAt ? `已转达 ${m.relayedAt}` : "待平台转达"}
            </Badge>
          ) : (
            <Badge tone="teal" icon={null}>
              平台消息
            </Badge>
          )}
        </div>
        <span className="fbg-num text-xs text-(--fbg-text-secondary)">{m.at}</span>
      </header>

      <div className="mt-3 flex flex-col gap-2">
        <p className="text-[15px] leading-7 text-(--fbg-text-primary)">{m.zh}</p>
        {m.en ? (
          <p className="text-sm leading-7 text-(--fbg-text-secondary)" lang="en-US">
            {m.en}
          </p>
        ) : null}
        {m.translationNote ? (
          <p className="text-xs text-(--fbg-text-secondary)">{m.translationNote}</p>
        ) : null}
      </div>

      {m.attachments.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {m.attachments.map((a) => (
            <li
              key={a.name}
              className="fbg-num inline-flex items-center gap-1 rounded-(--fbg-radius-chip) border border-(--fbg-border-subtle) px-2 py-1 text-xs text-(--fbg-text-secondary)"
            >
              <Icon name="document" size={12} /> {a.name} · {a.status}（供应商提供，未核验）
            </li>
          ))}
        </ul>
      ) : null}

      {m.notice ? (
        <div className="mt-3">
          <Notice tone="warn" title="平台说明">
            {m.notice}
          </Notice>
        </div>
      ) : null}
    </article>
  );
}

function Composer({
  thread,
  text,
  onText,
  attachments,
  onFiles,
  onRemoveAttachment,
  fileError,
  onSubmit,
}: {
  thread: SmThread;
  text: string;
  onText: (v: string) => void;
  attachments: SmAttachment[];
  onFiles: (files: File[]) => void;
  onRemoveAttachment: (name: string) => void;
  fileError: string | null;
  onSubmit: () => void;
}) {
  const open = canReply(thread);
  const status = smThreadStatus(thread);
  const validation = validateReplyZh(text);
  const blockedReason =
    thread.kind === "通知"
      ? "平台通知无需回复。如有疑问，请在相关询价单中处理。"
      : thread.closed
        ? "此会话已结束。如有新问题，请在相关询价单中发起。"
        : status === "待转达"
          ? "上一条回复待平台转达，转达后可继续回复。"
          : null;

  if (!open) return <p className="text-xs text-(--fbg-text-secondary)">{blockedReason}</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-(--fbg-text-primary)">回复买家</p>
      <TextArea
        id="sm-reply"
        aria-label="回复内容"
        rows={2}
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="请用中文回复。平台翻译为英文，运营核对后转达；请勿附带联系方式或在消息中报价。"
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
      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li
              key={a.name}
              className="fbg-num inline-flex items-center gap-1 rounded-(--fbg-radius-chip) border border-(--fbg-border-subtle) px-2 py-1 text-xs text-(--fbg-text-primary)"
            >
              <Icon name="document" size={12} /> {a.name}
              <button
                type="button"
                aria-label={`移除 ${a.name}`}
                onClick={() => onRemoveAttachment(a.name)}
                className="ml-1 text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)"
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {fileError ? <p className="text-xs text-(--fbg-status-danger)">{fileError}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="sm-attach"
          className={cx(buttonClasses("secondary", "sm"), "cursor-pointer")}
        >
          <Icon name="upload" size={14} /> 附加文件
        </label>
        <input
          id="sm-attach"
          type="file"
          multiple
          accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
          className="sr-only"
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Button variant="primary" icon="message" disabled={!validation.ok} onClick={onSubmit}>
          提交回复（平台转达）
        </Button>
        <span className="text-xs text-(--fbg-text-secondary)">
          文件先经平台扫描，标注为“供应商提供，未核验”；买家所见为英文译文。
        </span>
      </div>
    </div>
  );
}

function ThreadFacts({ thread }: { thread: SmThread }) {
  const rows = relayLog(thread);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <KeyValue
        columns={1}
        items={[
          {
            label: "买家",
            value: (
              <span>
                {thread.buyerLabel}
                <span className="block text-xs text-(--fbg-text-secondary)">
                  买家公司名称与联系方式在买家授权前不向供应商展示。
                </span>
              </span>
            ),
          },
          ...(thread.rfqRef
            ? [{ label: "询价单", value: <span className="fbg-num">{thread.rfqRef}</span> }]
            : []),
          {
            label: "渠道",
            value:
              "平台消息。微信转达仅在您于“数据共享设置”中提供的业务联系方式下使用，且由平台运营执行；平台不会把您的联系方式发给买家。",
          },
          {
            label: "可见范围",
            value: "您的企业账号、平台运营，以及收到转达消息的买家（仅英文译文）。",
          },
        ]}
      />
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">转达记录</p>
        {rows.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">尚无转达记录。</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1.5">
            {rows.map((r) => (
              <li key={r.messageId} className="fbg-num text-xs text-(--fbg-text-secondary)">
                提交 {r.sentAt} · 转达 {r.relayedAt} · {r.channel} · 核对：{r.checkedBy}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          每条转达记录包含渠道、核对人、时间与原文。
        </p>
      </div>
    </div>
  );
}
