"use client";

/**
 * Internal operations: Quotes Awaiting Review (IA §2.4 `/ops/review`, `/ops/review/[taskId]`; §3 ReviewSplit).
 * Design concept with working local interactions: queue → split view → anchors → corrections → accept gate.
 * The document pane is a synthetic rendering, not a PDF viewer. Local state only.
 */
import { useMemo, useState } from "react";
import {
  DEMO_REVIEW_QUEUE,
  type Confidence,
  type ExtractedField,
  type ReviewTask,
} from "../demo-data";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import { Badge, Button, Notice, PageHeader, Panel, Select, TextInput, cx } from "../ui/primitives";

interface Correction {
  id: number;
  field: string;
  before: string | null;
  after: string;
  who: string;
  when: string;
}

/** Synthetic source document: a Chinese quotation sheet with addressable lines (anchors). */
const DOC_LINES: Array<{ id: string; text: string; zh?: boolean; table?: boolean; page: 1 | 2 }> = [
  {
    id: "p.1 · header",
    text: "报价单  Quotation — 演示供应商F（Supplier F, demo）  货币 Currency: CNY",
    zh: true,
    page: 1,
  },
  { id: "p.1 · line 2", text: "致：Demo Buyer Co.    日期：2026年11月5日", zh: true, page: 1 },
  {
    id: "p.1 · line 3",
    text: "产品：折叠纸盒 350g 单铜 哑膜  Folding carton, 350 gsm C1S, matte lamination",
    zh: true,
    page: 1,
  },
  { id: "p.1 · line 9", text: "价格条款：出厂价", zh: true, page: 1 },
  {
    id: "p.1 · table col 3",
    text: "数量 (pcs)        单价 (元/pcs)        备注",
    zh: true,
    table: true,
    page: 1,
  },
  { id: "p.1 · table row 1", text: "3,000 – 4,999        1.85", table: true, page: 1 },
  { id: "p.1 · table row 2", text: "5,000 – 9,999        1.62", table: true, page: 1 },
  {
    id: "p.1 · table row 3",
    text: "10,000 以上          1.48        （需确认 subject to confirmation）",
    zh: true,
    table: true,
    page: 1,
  },
  { id: "p.2 · note 1", text: "备注1：交期 18 天（稿件确认后）", zh: true, page: 2 },
  { id: "p.2 · note 2", text: "备注2：刀模费 1,200 元，一次性收取", zh: true, page: 2 },
  { id: "p.2 · note 3", text: "备注3：付款方式 30% 定金，70% 发货前付清", zh: true, page: 2 },
  { id: "p.2 · footer", text: "以上报价仅供参考，最终以合同为准。", zh: true, page: 2 },
];

const CONFIDENCE_LABEL: Record<Confidence, string> = { high: "High", medium: "Medium", low: "Low" };
const CONFIDENCE_SEGMENTS: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

function ConfidenceBand({ level }: { level: Confidence }) {
  const n = CONFIDENCE_SEGMENTS[level];
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Extraction confidence: ${CONFIDENCE_LABEL[level]}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx(
              "h-2 w-3 rounded-sm",
              i <= n
                ? level === "low"
                  ? "bg-warn"
                  : level === "medium"
                    ? "bg-slate"
                    : "bg-teal"
                : "bg-line",
            )}
          />
        ))}
      </span>
      <span className="text-[11px] text-slate">{CONFIDENCE_LABEL[level]}</span>
    </span>
  );
}

export function OpsQuoteReview() {
  const [queue, setQueue] = useState<ReviewTask[]>(DEMO_REVIEW_QUEUE);
  const [selectedId, setSelectedId] = useState<string>("rt_demo_1");
  const [fields, setFields] = useState<ExtractedField[]>(() => DEMO_REVIEW_QUEUE[0]?.fields ?? []);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [pane, setPane] = useState<"document" | "fields">("fields");

  const task = queue.find((t) => t.id === selectedId) ?? queue[0];

  const selectTask = (t: ReviewTask) => {
    setSelectedId(t.id);
    setFields(t.fields);
    setActiveAnchor(null);
    setCorrections([]);
    setAccepted(false);
  };

  const assignToMe = (t: ReviewTask) => {
    setQueue((q) =>
      q.map((x) =>
        x.id === t.id ? { ...x, assignedTo: "Operator (demo)", status: "in_review" } : x,
      ),
    );
  };

  const updateField = (key: string, after: string) => {
    const field = fields.find((f) => f.key === key);
    if (!field || field.value === after) return;
    setCorrections((c) => [
      ...c,
      {
        id: Date.now(),
        field: field.label,
        before: field.value,
        after,
        who: "Operator (demo)",
        when: new Date().toISOString().slice(0, 16).replace("T", " "),
      },
    ]);
    setFields((fs) =>
      fs.map((f) => (f.key === key ? { ...f, value: after, confidence: "high" } : f)),
    );
  };

  // AC-B3.4: cannot accept while currency, unit, at least one tier, or price_basis (may be `unknown`) is missing.
  const gate = useMemo(() => {
    const get = (k: string) => fields.find((f) => f.key === k)?.value ?? null;
    const missing: string[] = [];
    if (!get("currency")) missing.push("currency");
    if (!get("unit")) missing.push("unit");
    if (!fields.some((f) => f.key.startsWith("tier") && f.value)) missing.push("at least one tier");
    if (!get("priceBasis")) missing.push("price basis (choose a term or mark unknown)");
    return missing;
  }, [fields]);

  const basisField = fields.find((f) => f.key === "priceBasis");

  return (
    <AppShell workspace="ops" title="Quotes awaiting review">
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="lock" title="Internal workspace">
          Supplier contact details are visible only to operators assigned to the project. Every
          value accepted here becomes an immutable quotation version; the AI proposal stays viewable
          alongside your corrections.
        </Notice>

        <PageHeader
          title="Quotes awaiting review"
          lead="Extracted values are proposals. Check each one against its anchor in the source document before accepting."
          meta={
            <Badge tone="neutral" icon="clock" className="fbg-num">
              {queue.filter((t) => t.status === "pending").length} unassigned ·{" "}
              {queue.filter((t) => t.status === "in_review").length} in review
            </Badge>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
          {/* Queue */}
          <Panel title="Queue" padded={false} className="xl:sticky xl:top-20 xl:self-start">
            <ul className="divide-y divide-line">
              {queue.map((t) => {
                const active = t.id === task?.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTask(t)}
                      aria-pressed={active}
                      className={cx(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-paper",
                        active && "bg-teal/5",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">{t.supplier}</span>
                        <Badge tone={t.status === "in_review" ? "teal" : "neutral"} icon={null}>
                          {t.status === "in_review" ? "In review" : "Pending"}
                        </Badge>
                      </span>
                      <span className="truncate text-[12px] text-slate">{t.project}</span>
                      <span className="flex items-center justify-between text-[12px] text-slate">
                        <span className="truncate">{t.document}</span>
                        <span className="fbg-num shrink-0">{t.receivedAt.slice(5)}</span>
                      </span>
                      <span className="text-[12px] text-slate">
                        {t.buyerOrg} · {t.assignedTo ?? "Unassigned"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Review split */}
          {task ? (
            task.fields.length === 0 ? (
              <Panel title={task.supplier} description={`${task.project} · ${task.document}`}>
                <div className="flex flex-col items-start gap-3">
                  <p className="text-[13px] text-slate">
                    Extraction has not run for this document yet. Assign it to yourself to start;
                    the worker parses, extracts and queues the fields for review.
                  </p>
                  {task.assignedTo ? (
                    <Badge tone="teal">Assigned to {task.assignedTo} — extraction queued</Badge>
                  ) : (
                    <Button variant="primary" onClick={() => assignToMe(task)}>
                      Assign to me
                    </Button>
                  )}
                </div>
              </Panel>
            ) : (
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-ink">
                      {task.supplier}{" "}
                      <span className="font-normal text-slate">· {task.document}</span>
                    </h2>
                    <p className="text-[12px] text-slate">
                      {task.project} · {task.buyerOrg} · received {task.receivedAt} ·{" "}
                      {task.assignedTo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 lg:hidden">
                    <div
                      role="radiogroup"
                      aria-label="Pane"
                      className="inline-flex rounded-md border border-line bg-paper p-0.5"
                    >
                      {(["document", "fields"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={pane === p}
                          onClick={() => setPane(p)}
                          className={cx(
                            "h-8 rounded px-3 text-[13px] font-medium",
                            pane === p ? "bg-ink text-white" : "text-slate",
                          )}
                        >
                          {p === "document" ? "Document" : "Fields"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {/* Document pane */}
                  <Panel
                    title="Source document"
                    description="Synthetic rendering. Click an anchor in the field list to highlight its line."
                    padded={false}
                    className={cx(pane !== "document" && "hidden lg:block")}
                  >
                    <div className="max-h-[70vh] overflow-y-auto p-4">
                      {[1, 2].map((page) => (
                        <div
                          key={page}
                          className="mb-4 rounded border border-line bg-paper p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.6)]"
                        >
                          <p className="fbg-num mb-2 text-[11px] text-slate">Page {page}</p>
                          <ol className="flex flex-col gap-1">
                            {DOC_LINES.filter((l) => l.page === page).map((l) => {
                              const active = l.id === activeAnchor;
                              return (
                                <li
                                  key={l.id}
                                  id={`anchor-${l.id}`}
                                  className={cx(
                                    "rounded px-2 py-1 text-[13px]",
                                    l.table ? "fbg-num font-mono text-[12px]" : "",
                                    l.zh ? "fbg-zh" : "",
                                    active ? "bg-accent/15 ring-1 ring-accent" : "text-ink",
                                  )}
                                  lang={l.zh ? "zh-CN" : undefined}
                                >
                                  {l.text}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  {/* Field pane */}
                  <Panel
                    title="Extracted fields"
                    description="Unknown values are null and labelled “Not in document”, never a default."
                    padded={false}
                    className={cx(pane !== "fields" && "hidden lg:block")}
                  >
                    <ul className="divide-y divide-line">
                      {fields.map((f) => (
                        <li key={f.key} className="flex flex-col gap-1.5 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor={`f_${f.key}`}
                              className="text-[13px] font-medium text-ink"
                            >
                              {f.label}
                            </label>
                            <ConfidenceBand level={f.confidence} />
                          </div>
                          {f.key === "priceBasis" ? (
                            <Select
                              id={`f_${f.key}`}
                              value={f.value ?? ""}
                              onChange={(e) => updateField(f.key, e.target.value)}
                              aria-describedby={f.flag ? `flag_${f.key}` : undefined}
                            >
                              <option value="">Not confirmed</option>
                              <option value="unknown">unknown — request confirmation</option>
                              {["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DPU", "DDP"].map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <TextInput
                              id={`f_${f.key}`}
                              value={f.value ?? ""}
                              placeholder={f.value === null ? "Not in document" : undefined}
                              onBlur={(e) =>
                                e.target.value !== (f.value ?? "") &&
                                updateField(f.key, e.target.value)
                              }
                              defaultValue={undefined}
                              onChange={(e) =>
                                setFields((fs) =>
                                  fs.map((x) =>
                                    x.key === f.key
                                      ? {
                                          ...x,
                                          value: e.target.value === "" ? null : e.target.value,
                                        }
                                      : x,
                                  ),
                                )
                              }
                              className={cx(f.key.startsWith("tier") && "fbg-num")}
                            />
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-[12px]">
                            {f.anchor ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveAnchor(f.anchor);
                                  setPane("document");
                                  document
                                    .getElementById(`anchor-${f.anchor}`)
                                    ?.scrollIntoView({ block: "center" });
                                }}
                                className={cx(
                                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium",
                                  activeAnchor === f.anchor
                                    ? "border-accent bg-accent/10 text-accent"
                                    : "border-line text-slate hover:border-ink/30 hover:text-ink",
                                )}
                                aria-pressed={activeAnchor === f.anchor}
                              >
                                <Icon name="eye" size={12} /> {f.anchor}
                              </button>
                            ) : (
                              <Badge tone="neutral" icon="info">
                                Not in document
                              </Badge>
                            )}
                            {f.flag ? (
                              <span
                                id={`flag_${f.key}`}
                                className="flex items-start gap-1 text-warn"
                              >
                                <Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {f.flag}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>

                {/* Corrections + accept */}
                <div className="grid gap-3 lg:grid-cols-2">
                  <Panel
                    title="Corrections"
                    description="Each edit stores before, after, who and when. The AI proposal stays viewable."
                    padded={false}
                  >
                    {corrections.length === 0 ? (
                      <p className="px-4 py-3 text-[13px] text-slate">No corrections yet.</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {corrections.map((c) => (
                          <li key={c.id} className="px-4 py-2 text-[13px]">
                            <p className="font-medium text-ink">{c.field}</p>
                            <p className="text-slate">
                              <span className="line-through">{c.before ?? "null"}</span> →{" "}
                              <span className="text-ink">{c.after}</span>
                            </p>
                            <p className="fbg-num text-[12px] text-slate">
                              {c.who} · {c.when}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                  <Panel title="Accept as quotation v1">
                    {accepted ? (
                      <Notice tone="ok" title="Accepted — quotation version 1 created">
                        The quotation is now immutable; later changes create version 2. It can enter
                        comparisons for {task.buyerOrg} once its brief is confirmed.
                      </Notice>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {gate.length > 0 ? (
                          <Notice tone="warn" title="Cannot accept yet">
                            Missing: {gate.join(", ")}.
                            {basisField && !basisField.value ? (
                              <span className="block pt-1">
                                出厂价 is colloquial for an ex-works price but carries no Incoterm
                                code or named place. Mark the basis <em>unknown</em> and request
                                confirmation rather than assuming EXW.
                              </span>
                            ) : null}
                          </Notice>
                        ) : (
                          <Notice tone="ok" title="Ready to accept">
                            Currency, unit, tiers and price basis are present.
                            {basisField?.value === "unknown"
                              ? " Basis is recorded as unknown; the quote will sit in the “basis not stated” group until confirmed."
                              : ""}
                          </Notice>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {basisField && !basisField.value ? (
                            <Button onClick={() => updateField("priceBasis", "unknown")}>
                              Mark basis unknown
                            </Button>
                          ) : null}
                          <Button
                            variant="primary"
                            disabled={gate.length > 0}
                            onClick={() => setAccepted(true)}
                          >
                            Accept as v1
                          </Button>
                          <Button variant="danger">Reject document</Button>
                        </div>
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
