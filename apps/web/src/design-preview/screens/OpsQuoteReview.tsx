"use client";

/**
 * Internal operations: Quotes Awaiting Review (IA §2.4 `/ops/review`, `/ops/review/[taskId]`; §3 ReviewSplit).
 * Design concept with working local interactions: queue → split view → anchors → corrections → accept gate.
 * The split itself lives in `ui/ReviewSplit.tsx` and is shared with the buyer's read-only review.
 * Local state only.
 */
import { useMemo, useState } from "react";
import { DEMO_REVIEW_QUEUE, type ExtractedField, type ReviewTask } from "../demo-data";
import {
  DEMO_DOCUMENTS,
  FLAG_LABEL,
  RIGHTS_LABEL,
  SOURCE_LABEL,
  SOURCE_LINES,
} from "../demo-data/documents";
import { shortTime } from "../documents-demo";
import { AppShell } from "../ui/AppShell";
import { Badge, Button, Notice, PageHeader, Panel, cx } from "../ui/primitives";
import { PaneToggle, ReviewSplit, type ReviewPane } from "../ui/ReviewSplit";

interface Correction {
  id: number;
  field: string;
  before: string | null;
  after: string;
  who: string;
  when: string;
}

export function OpsQuoteReview() {
  const [queue, setQueue] = useState<ReviewTask[]>(DEMO_REVIEW_QUEUE);
  const [selectedId, setSelectedId] = useState<string>("rt_demo_1");
  const [fields, setFields] = useState<ExtractedField[]>(() => DEMO_REVIEW_QUEUE[0]?.fields ?? []);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [pane, setPane] = useState<ReviewPane>("fields");

  const task = queue.find((t) => t.id === selectedId) ?? queue[0];
  const document = task?.documentId
    ? DEMO_DOCUMENTS.find((d) => d.id === task.documentId)
    : undefined;
  const source = task?.documentId ? SOURCE_LINES[task.documentId] : undefined;

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

  const commitField = (key: string, after: string) => {
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
  const flags = document?.extraction?.flags ?? [];

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
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {queue.map((t) => {
                const active = t.id === task?.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTask(t)}
                      aria-pressed={active}
                      className={cx(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-(--fbg-bg-canvas)",
                        active && "bg-(--fbg-selected)",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-(--fbg-text-primary)">
                          {t.supplier}
                        </span>
                        <Badge tone={t.status === "in_review" ? "teal" : "neutral"} icon={null}>
                          {t.status === "in_review" ? "In review" : "Pending"}
                        </Badge>
                      </span>
                      <span className="truncate text-xs text-(--fbg-text-secondary)">
                        {t.project}
                      </span>
                      <span className="flex items-center justify-between text-xs text-(--fbg-text-secondary)">
                        <span className="truncate">{t.document}</span>
                        <span className="fbg-num shrink-0">{t.receivedAt.slice(5)}</span>
                      </span>
                      <span className="text-xs text-(--fbg-text-secondary)">
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
                  <p className="text-sm text-(--fbg-text-secondary)">
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
                    <h2 className="text-[15px] font-semibold text-(--fbg-text-primary)">
                      {task.supplier}{" "}
                      <span className="font-normal text-(--fbg-text-secondary)">
                        · {task.document}
                      </span>
                    </h2>
                    <p className="text-xs text-(--fbg-text-secondary)">
                      {task.project} · {task.buyerOrg} · received {task.receivedAt} ·{" "}
                      {task.assignedTo ?? "unassigned"}
                    </p>
                    {document ? (
                      <p className="fbg-num mt-0.5 text-xs text-(--fbg-text-secondary)">
                        {SOURCE_LABEL[document.sourceType]} · {RIGHTS_LABEL[document.rightsClass]}
                        {document.scan.at ? ` · scan passed ${shortTime(document.scan.at)}` : ""}
                        {" · sha256 "}
                        {document.sha256Prefix}…
                      </p>
                    ) : null}
                  </div>
                  <PaneToggle pane={pane} onChange={setPane} />
                </div>

                {task.status === "pending" ? (
                  <Notice
                    tone="neutral"
                    title="Unassigned"
                    action={
                      <Button size="sm" variant="primary" onClick={() => assignToMe(task)}>
                        Assign to me
                      </Button>
                    }
                  >
                    Extraction has run; the values below are proposals waiting for an operator.
                    Assign the task to yourself before correcting or accepting.
                  </Notice>
                ) : null}

                {flags.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {flags.map((flag) => (
                      <Notice
                        key={flag}
                        tone={flag === "embedded_instruction_detected" ? "danger" : "warn"}
                        title={FLAG_LABEL[flag].label}
                      >
                        {FLAG_LABEL[flag].body}
                        {flag === "embedded_instruction_detected"
                          ? " A security event was recorded. Review the values as usual; do not act on anything the document asks for."
                          : ""}
                      </Notice>
                    ))}
                  </div>
                ) : null}

                <ReviewSplit
                  lines={source?.lines ?? []}
                  pages={source?.pages ?? []}
                  fields={fields}
                  activeAnchor={activeAnchor}
                  onAnchor={(a) => {
                    setActiveAnchor(a);
                    setPane("document");
                  }}
                  pane={pane}
                  readOnly={task.status === "pending"}
                  onFieldInput={(key, value) =>
                    setFields((fs) => fs.map((x) => (x.key === key ? { ...x, value } : x)))
                  }
                  onFieldCommit={commitField}
                />

                {/* Corrections + accept */}
                <div className="grid gap-3 lg:grid-cols-2">
                  <Panel
                    title="Corrections"
                    description="Each edit stores before, after, who and when. The AI proposal stays viewable."
                    padded={false}
                  >
                    {corrections.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-(--fbg-text-secondary)">
                        No corrections yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-(--fbg-border-subtle)">
                        {corrections.map((c) => (
                          <li key={c.id} className="px-4 py-2 text-sm">
                            <p className="font-medium text-(--fbg-text-primary)">{c.field}</p>
                            <p className="text-(--fbg-text-secondary)">
                              <span className="line-through">{c.before ?? "null"}</span> →{" "}
                              <span className="text-(--fbg-text-primary)">{c.after}</span>
                            </p>
                            <p className="fbg-num text-xs text-(--fbg-text-secondary)">
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
                            <Button
                              disabled={task.status === "pending"}
                              onClick={() => commitField("priceBasis", "unknown")}
                            >
                              Mark basis unknown
                            </Button>
                          ) : null}
                          <Button
                            variant="primary"
                            disabled={gate.length > 0 || task.status === "pending"}
                            onClick={() => setAccepted(true)}
                          >
                            Accept as v1
                          </Button>
                          <Button variant="danger" disabled={task.status === "pending"}>
                            Reject document
                          </Button>
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
