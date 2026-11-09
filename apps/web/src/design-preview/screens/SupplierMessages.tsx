"use client";

/**
 * 供应商工作台：消息 (IA `/supplier/messages`). The supplier's side of the threads: buyer questions
 * relayed by the platform in Chinese with the English original, the supplier's replies with their
 * relay state, platform notices, and a reply composer whose text goes to the operator for
 * translation, checking and relay. Buyer identity is an anonymized label; contact details never
 * appear. Local state only; nothing is sent.
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
  Tabs,
  TextArea,
  cx,
} from "../ui/primitives";

type Filter = "全部" | "待回复" | "已转达" | "已完成" | "通知";

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

  const rightRail = thread ? (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">依据</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">谁能看到，如何转达</p>
      </div>
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
    <AppShell workspace="supplier" title="消息" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <div className={cx(view === "thread" && "hidden lg:block")}>
          <PageHeader
            title="消息"
            lead="买家的问题由平台翻译并转达；您的回复经平台运营核对后转达买家。买家公司名称与联系方式在授权前不向您展示，您的联系方式也不会随消息发送。"
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

        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <div className={cx("flex min-w-0 flex-col gap-3", view === "thread" && "hidden lg:flex")}>
            <Tabs
              label="消息状态"
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: "全部", label: "全部", count: countFor("全部") },
                { value: "待回复", label: "待回复", count: countFor("待回复") },
                { value: "已转达", label: "已转达", count: countFor("已转达") },
                { value: "已完成", label: "已完成", count: countFor("已完成") },
                { value: "通知", label: "通知", count: countFor("通知") },
              ]}
            />
            <Panel padded={false}>
              {rows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="没有符合条件的消息" body="请调整筛选条件。" icon="message" />
                </div>
              ) : (
                <ul className="divide-y divide-(--fbg-border-subtle)">
                  {rows.map((t) => {
                    const s = smThreadStatus(t);
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
                            <span className="flex min-w-0 items-start gap-2">
                              {t.unread ? (
                                <span
                                  aria-label="未读"
                                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-(--fbg-brand-accent)"
                                />
                              ) : null}
                              <span
                                className={cx(
                                  "min-w-0 text-sm text-(--fbg-text-primary)",
                                  t.unread ? "font-semibold" : "font-medium",
                                )}
                              >
                                {t.subject}
                              </span>
                            </span>
                            <Badge tone={SM_STATUS_TONE[s]} icon={null}>
                              {s}
                            </Badge>
                          </span>
                          <span className="truncate text-xs text-(--fbg-text-secondary)">
                            {t.buyerLabel}
                            {t.rfqRef ? ` · ${t.rfqRef}` : ""}
                          </span>
                          {last ? (
                            <span className="line-clamp-2 text-xs text-(--fbg-text-secondary)">
                              {last.zh}
                            </span>
                          ) : null}
                          <span className="fbg-num text-[11px] text-(--fbg-text-secondary)">
                            {SM_KIND_LABEL[t.kind]} · {smLastActivity(t)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className={cx("flex min-w-0 flex-col gap-4", view === "list" && "hidden lg:flex")}>
            {thread && status ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) text-(--fbg-text-secondary) lg:hidden"
                      aria-label="返回消息列表"
                    >
                      <Icon name="chevron-right" size={16} className="rotate-180" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">
                        {thread.subject}
                      </h2>
                      <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                        {thread.buyerLabel}
                        {thread.rfqRef ? ` · ${thread.rfqRef}` : ""} · {SM_KIND_LABEL[thread.kind]}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SM_STATUS_TONE[status]} icon={null} title={SM_STATUS_HINT[status]}>
                      {status}
                    </Badge>
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
                </div>
                <p className="text-xs text-(--fbg-text-secondary)">{SM_STATUS_HINT[status]}</p>

                <ol className="flex flex-col gap-3" aria-label="消息记录">
                  {thread.messages.map((m) => (
                    <li key={m.id}>
                      {m.direction === "平台" ? (
                        <div className="flex items-start gap-2 rounded-(--fbg-radius-control) border border-dashed border-(--fbg-border-subtle) px-3 py-2 text-xs text-(--fbg-text-secondary)">
                          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                          <span>
                            <span className="fbg-num">{m.at}</span> · 平台 · {m.zh}
                          </span>
                        </div>
                      ) : (
                        <MessageCard m={m} />
                      )}
                    </li>
                  ))}
                </ol>

                <Composer
                  thread={thread}
                  text={replyText}
                  onText={setReplyText}
                  attachments={attachments}
                  onFiles={addFiles}
                  onRemoveAttachment={(name) =>
                    setAttachments((prev) => prev.filter((a) => a.name !== name))
                  }
                  fileError={fileError}
                  onSubmit={() => submitReply(thread)}
                />

                <div className="xl:hidden">
                  <Panel title="谁能看到，如何转达">
                    <ThreadFacts thread={thread} />
                  </Panel>
                </div>
              </>
            ) : (
              <EmptyState title="请选择一条消息" body="待回复的消息排在最前。" icon="message" />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MessageCard({ m }: { m: SmMessage }) {
  const mine = m.direction === "我方";
  return (
    <article
      className={cx(
        "rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) border-l-4 bg-(--fbg-bg-surface) p-4",
        mine ? "border-l-(--fbg-brand-accent)" : "border-l-(--fbg-action-primary)",
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
        <p className="text-sm text-(--fbg-text-primary)">{m.zh}</p>
        {m.en ? (
          <p className="text-sm text-(--fbg-text-secondary)" lang="en-US">
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

  return (
    <Panel
      title="回复买家"
      description="请用中文回复。平台会翻译为英文，由运营核对后转达买家；请勿附带联系方式或在消息中报价。"
    >
      {!open ? (
        <p className="text-sm text-(--fbg-text-secondary)">{blockedReason}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <TextArea
            aria-label="回复内容"
            rows={3}
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder="例如：“出厂价”指 EXW 东莞；刀模费 不含在单价内，一次性收取。"
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
          <div className="flex flex-col gap-2">
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
              <span className="text-xs text-(--fbg-text-secondary)">
                PDF、XLSX、CSV、PNG、JPG、WebP，单个 25 MB
                以内；文件先经平台扫描，标注为“供应商提供，未核验”。
              </span>
            </div>
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon="message" disabled={!validation.ok} onClick={onSubmit}>
              提交回复（平台转达）
            </Button>
            <span className="text-xs text-(--fbg-text-secondary)">
              转达后买家所见为英文译文；中文原文保留在记录中。
            </span>
          </div>
        </div>
      )}
    </Panel>
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
