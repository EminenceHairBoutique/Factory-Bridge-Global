"use client";

/**
 * Internal operations: Buyer cases (IA §2.4 `/ops/cases`; master spec §6.8). A buyer's question,
 * data issue, request or complaint with every buyer-visible update linked to the record it
 * concerns; internal notes the buyer never sees; replies checked against the no-claims and
 * no-SLA-promise rules; resolution with a code and a buyer-visible note; escalation with a target
 * and reason; pilot turnaround targets shown internally only. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BUYER_CASES,
  CASES_NOW,
  CATEGORY_LABEL,
  CASE_TARGET_HOURS,
  RESOLUTION_LABEL,
  SOURCE_LABEL,
  type BuyerCase,
  type ResolutionCode,
} from "../demo-data/ops-cases";
import {
  ESCALATION_TARGETS,
  STATUS_LABEL,
  STATUS_TONE,
  applyEscalate,
  applyNote,
  applyReopen,
  applyReply,
  applyResolve,
  caseSla,
  casesSummary,
  claimsCheck,
  priorityOf,
  sortCases,
  validateEscalation,
  validateNote,
  validateReply,
  validateResolution,
} from "../cases-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";

type Filter = "active" | "open" | "awaiting" | "resolved";
type Mode = "reply" | "note" | "resolve" | "escalate" | "reopen";

const SLA_TONE = { overdue: "danger", due_soon: "warn", on_track: "neutral" } as const;
const ACTOR = "Operator (demo)";

export function OpsBuyerCases({ initialCaseId }: { initialCaseId?: string | undefined }) {
  const [cases, setCases] = useState<BuyerCase[]>(BUYER_CASES);
  const [filter, setFilter] = useState<Filter>("active");
  const [selectedId, setSelectedId] = useState<string>(
    initialCaseId && BUYER_CASES.some((c) => c.id === initialCaseId)
      ? initialCaseId
      : (sortCases(BUYER_CASES, CASES_NOW)[0]?.id ?? ""),
  );
  const [mode, setMode] = useState<Mode>("reply");
  const [replyText, setReplyText] = useState("");
  const [replyLinked, setReplyLinked] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [resCode, setResCode] = useState<ResolutionCode | null>(null);
  const [resNote, setResNote] = useState("");
  const [escTo, setEscTo] = useState("");
  const [escReason, setEscReason] = useState("");
  const [reopenText, setReopenText] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const summary = useMemo(() => casesSummary(cases, CASES_NOW), [cases]);
  const rows = useMemo(
    () =>
      sortCases(cases, CASES_NOW).filter((c) =>
        filter === "active"
          ? c.status !== "resolved"
          : filter === "open"
            ? c.status === "open"
            : filter === "awaiting"
              ? c.status === "awaiting_buyer"
              : c.status === "resolved",
      ),
    [cases, filter],
  );
  const current = cases.find((c) => c.id === selectedId) ?? null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);
  const now = () => `${CASES_NOW.slice(0, 10)} ${new Date().toISOString().slice(11, 16)}`;
  const update = (id: string, fn: (c: BuyerCase) => BuyerCase) =>
    setCases((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const select = (id: string) => {
    setSelectedId(id);
    setMode("reply");
    setReplyText("");
    setReplyLinked(null);
    setNoteText("");
    setResCode(null);
    setResNote("");
    setEscTo("");
    setEscReason("");
    setReopenText("");
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">Case rules</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>
          Every reply names the record it concerns (document, quotation, report, snapshot, supplier
          check). Buyers follow the link; they never get a bare assertion.
        </li>
        <li>
          Replies carry no claims: no “lowest price”, “guarantee”, “zero defects”, “verified
          factory”, and no response-time promise. The composer blocks them.
        </li>
        <li>
          Turnaround targets below are pilot targets for the team. They are never shown to buyers.
        </li>
        <li>
          Internal notes stay internal. The buyer sees their messages, your replies and the
          resolution note.
        </li>
        <li>
          Supplier-facing follow-ups still go through Messages with the approval chain; a case never
          messages a supplier.
        </li>
      </ul>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Pilot targets (internal)</p>
        <ul className="mt-1 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
          {(Object.keys(CASE_TARGET_HOURS) as Array<keyof typeof CASE_TARGET_HOURS>).map((k) => (
            <li key={k} className="fbg-num">
              {CATEGORY_LABEL[k]}: {CASE_TARGET_HOURS[k]} h
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Actions this session</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">Nothing yet.</p>
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
  );

  return (
    <AppShell workspace="ops" title="Buyer cases" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="lock" title="Internal workspace">
          Buyers see their own messages, your replies and the resolution note. Internal notes,
          escalations and turnaround targets never leave this workspace.
        </Notice>

        <PageHeader
          title="Buyer cases"
          lead="Questions, data issues, requests and complaints from buyers, each answered with the record it concerns. Priority is derived, not chosen; targets are the team's, not a promise."
          meta={
            <>
              <Badge
                tone={summary.overdue > 0 ? "danger" : "ok"}
                icon={summary.overdue > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.overdue} past target
              </Badge>
              <Badge tone="warn" icon={null} className="fbg-num">
                {summary.open} open
              </Badge>
              <Badge tone="teal" icon={null} className="fbg-num">
                {summary.awaitingBuyer} awaiting buyer
              </Badge>
              <Badge tone="neutral" icon="flag" className="fbg-num">
                {summary.escalated} escalated
              </Badge>
            </>
          }
          actions={
            <Link href="/design-preview/ops/queue" className={buttonClasses("secondary")}>
              Work queue
            </Link>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <SegmentedControl
              label="Case filter"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "active", label: "Active" },
                { value: "open", label: "Open" },
                { value: "awaiting", label: "Buyer" },
                { value: "resolved", label: "Resolved" },
              ]}
            />
            <Panel padded={false}>
              {rows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No cases here" body="Change the filter." icon="message" />
                </div>
              ) : (
                <ul className="divide-y divide-(--fbg-border-subtle)">
                  {rows.map((c) => {
                    const sla = caseSla(c, CASES_NOW);
                    const active = c.id === selectedId;
                    const high = priorityOf(c, CASES_NOW) === "high";
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => select(c.id)}
                          aria-pressed={active}
                          className={cx(
                            "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                            active && "bg-(--fbg-selected)",
                          )}
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <Badge tone={STATUS_TONE[c.status]} icon={null}>
                              {STATUS_LABEL[c.status]}
                            </Badge>
                            {high && c.status !== "resolved" ? (
                              <Badge tone="danger" icon="alert">
                                High
                              </Badge>
                            ) : null}
                            {sla ? (
                              <Badge tone={SLA_TONE[sla.state]} icon="clock" className="fbg-num">
                                {sla.label}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                            {c.subject}
                          </span>
                          <span className="truncate text-[11px] text-(--fbg-text-secondary)">
                            {c.buyerOrg} · {CATEGORY_LABEL[c.category]} ·{" "}
                            {c.assignee ?? "Unassigned"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {current ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">
                      {current.subject}
                    </h2>
                    <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                      {current.ref} · {current.buyerOrg} ({current.contactName}) ·{" "}
                      {CATEGORY_LABEL[current.category]} · {SOURCE_LABEL[current.source]} · opened{" "}
                      {current.openedAt.slice(0, 16).replace("T", " ")} UTC ·{" "}
                      {current.assignee ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[current.status]} icon={null}>
                      {STATUS_LABEL[current.status]}
                    </Badge>
                    {priorityOf(current, CASES_NOW) === "high" && current.status !== "resolved" ? (
                      <Badge tone="danger" icon="alert">
                        High priority
                      </Badge>
                    ) : null}
                    {current.escalation ? (
                      <Badge tone="neutral" icon="flag">
                        Escalated to {current.escalation.to}
                      </Badge>
                    ) : null}
                    {current.project ? (
                      <Link href={current.project.href} className={buttonClasses("ghost", "sm")}>
                        Project
                      </Link>
                    ) : null}
                    {current.queueTaskId ? (
                      <Link
                        href="/design-preview/ops/queue"
                        className={buttonClasses("ghost", "sm")}
                      >
                        Queue task
                      </Link>
                    ) : null}
                  </div>
                </div>

                {current.resolution ? (
                  <Notice
                    tone="ok"
                    icon="check"
                    title={`Resolved: ${RESOLUTION_LABEL[current.resolution.code]} — ${current.resolution.by}, ${current.resolution.at}`}
                  >
                    {current.resolution.note} The buyer may reopen within 7 days.
                  </Notice>
                ) : current.status === "awaiting_buyer" ? (
                  <Notice tone="teal" title="Awaiting the buyer's confirmation">
                    Your reply is visible to the buyer. The case resolves when they confirm, or you
                    resolve it with a note they can see.
                  </Notice>
                ) : null}

                <Panel
                  title="Linked records"
                  description="What this case is about. Every buyer-visible reply points at one of these."
                  padded={false}
                >
                  <ul className="divide-y divide-(--fbg-border-subtle)">
                    {current.linked.map((l, i) => (
                      <li
                        key={`${l.kind}-${i}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"
                      >
                        <span className="text-(--fbg-text-primary)">
                          <Badge tone="neutral" icon={null}>
                            {l.kind}
                          </Badge>{" "}
                          {l.label}
                        </span>
                        {l.href ? (
                          <Link href={l.href} className={buttonClasses("ghost", "sm")}>
                            Open
                          </Link>
                        ) : null}
                      </li>
                    ))}
                    {current.linked.length === 0 ? (
                      <li className="px-5 py-3 text-sm text-(--fbg-text-secondary)">
                        No record linked yet.
                      </li>
                    ) : null}
                  </ul>
                </Panel>

                <Panel
                  title="Timeline"
                  description="Buyer-visible entries are marked; everything else stays internal."
                  padded={false}
                >
                  <ol className="divide-y divide-(--fbg-border-subtle)">
                    {current.updates.map((u) => (
                      <li
                        key={u.id}
                        className={cx(
                          "flex flex-col gap-1 px-5 py-3 text-sm",
                          !u.buyerVisible && "bg-(--fbg-bg-canvas)",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              u.kind === "buyer_message"
                                ? "ink"
                                : u.kind === "reply"
                                  ? "ok"
                                  : u.kind === "escalation"
                                    ? "warn"
                                    : "neutral"
                            }
                            icon={u.buyerVisible ? null : "lock"}
                          >
                            {u.kind === "buyer_message"
                              ? "Buyer"
                              : u.kind === "reply"
                                ? "Reply to buyer"
                                : u.kind === "internal_note"
                                  ? "Internal note"
                                  : u.kind === "escalation"
                                    ? "Escalation"
                                    : "Status"}
                          </Badge>
                          <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                            {u.at} · {u.by}
                          </span>
                          {u.buyerVisible ? (
                            <Badge tone="teal" icon="eye">
                              Buyer sees this
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-(--fbg-text-primary)">{u.text}</span>
                        {u.linked ? (
                          <span className="text-xs text-(--fbg-text-secondary)">
                            <Icon name="document" size={12} className="mr-1 inline" />
                            {u.linked.href ? (
                              <Link href={u.linked.href} className="underline">
                                {u.linked.label}
                              </Link>
                            ) : (
                              u.linked.label
                            )}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </Panel>

                {current.status === "resolved" ? (
                  <Panel
                    title="Reopen on the buyer's behalf"
                    description="Only with the buyer's own message; paste it here."
                  >
                    <TextArea
                      aria-label="Buyer's message"
                      rows={2}
                      value={reopenText}
                      onChange={(e) => setReopenText(e.target.value)}
                      placeholder="The buyer's words"
                    />
                    <div className="mt-3">
                      <Button
                        size="sm"
                        disabled={reopenText.trim().length < 10}
                        onClick={() => {
                          update(current.id, (c) => applyReopen(c, reopenText, now()));
                          note(`Reopened ${current.ref} with the buyer's message`);
                          setReopenText("");
                        }}
                      >
                        Reopen
                      </Button>
                    </div>
                  </Panel>
                ) : (
                  <Panel
                    title="Act on this case"
                    description={
                      mode === "reply"
                        ? "A reply is visible to the buyer and must name the record it concerns."
                        : mode === "note"
                          ? "Internal; the buyer never sees it."
                          : mode === "resolve"
                            ? "The resolution note is visible to the buyer."
                            : "Internal; the target is notified."
                    }
                  >
                    <SegmentedControl
                      label="Action"
                      size="sm"
                      value={mode}
                      onChange={setMode}
                      options={[
                        { value: "reply", label: "Reply to buyer" },
                        { value: "note", label: "Internal note" },
                        { value: "resolve", label: "Resolve" },
                        { value: "escalate", label: "Escalate" },
                      ]}
                    />

                    {mode === "reply" ? (
                      <div className="mt-4 flex flex-col gap-3">
                        <Field
                          label="Reply"
                          required
                          htmlFor="case-reply"
                          hint="Written by you. AI may draft; it never sends."
                        >
                          <TextArea
                            id="case-reply"
                            rows={4}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                        </Field>
                        <Field
                          label="Record this reply concerns"
                          required={current.category === "data_issue"}
                          htmlFor="case-linked"
                        >
                          <Select
                            id="case-linked"
                            value={replyLinked === null ? "" : String(replyLinked)}
                            onChange={(e) =>
                              setReplyLinked(e.target.value === "" ? null : Number(e.target.value))
                            }
                          >
                            <option value="">None</option>
                            {current.linked.map((l, i) => (
                              <option key={i} value={i}>
                                {l.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        {claimsCheck(replyText).length > 0 ? (
                          <Notice
                            tone="danger"
                            icon="alert"
                            title="This reply contains a claim buyers must not receive"
                          >
                            {claimsCheck(replyText).join(", ")} — rewrite it as what was checked, by
                            whom and when.
                          </Notice>
                        ) : null}
                        {replyText.length > 0 &&
                        validateReply({ text: replyText, linkedIndex: replyLinked }, current)
                          .length > 0 ? (
                          <ul className="text-xs text-(--fbg-status-danger)">
                            {validateReply(
                              { text: replyText, linkedIndex: replyLinked },
                              current,
                            ).map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        ) : null}
                        <div>
                          <Button
                            variant="primary"
                            icon="message"
                            disabled={
                              validateReply({ text: replyText, linkedIndex: replyLinked }, current)
                                .length > 0
                            }
                            onClick={() => {
                              update(current.id, (c) =>
                                applyReply(
                                  c,
                                  { text: replyText, linkedIndex: replyLinked },
                                  ACTOR,
                                  now(),
                                ),
                              );
                              note(`Replied to ${current.ref}; awaiting the buyer`);
                              setReplyText("");
                              setReplyLinked(null);
                            }}
                          >
                            Send reply to buyer
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {mode === "note" ? (
                      <div className="mt-4 flex flex-col gap-3">
                        <TextArea
                          aria-label="Internal note"
                          rows={3}
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder={`Note as ${ACTOR}`}
                        />
                        <div>
                          <Button
                            size="sm"
                            disabled={validateNote(noteText) !== null}
                            onClick={() => {
                              update(current.id, (c) => applyNote(c, noteText, ACTOR, now()));
                              note(`Internal note on ${current.ref}`);
                              setNoteText("");
                            }}
                          >
                            Add internal note
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {mode === "resolve" ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Field label="Resolution" required htmlFor="case-res">
                          <Select
                            id="case-res"
                            value={resCode ?? ""}
                            onChange={(e) =>
                              setResCode((e.target.value || null) as ResolutionCode | null)
                            }
                          >
                            <option value="">Choose</option>
                            {(Object.keys(RESOLUTION_LABEL) as ResolutionCode[]).map((k) => (
                              <option key={k} value={k}>
                                {RESOLUTION_LABEL[k]}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field
                          label="Note the buyer sees"
                          required
                          htmlFor="case-res-note"
                          className="md:col-span-2"
                        >
                          <TextInput
                            id="case-res-note"
                            value={resNote}
                            onChange={(e) => setResNote(e.target.value)}
                            placeholder="What resolved it, in plain words"
                          />
                        </Field>
                        {claimsCheck(resNote).length > 0 ? (
                          <p className="text-xs text-(--fbg-status-danger) md:col-span-2">
                            Remove {claimsCheck(resNote).join(", ")}.
                          </p>
                        ) : null}
                        <div className="md:col-span-2">
                          <Button
                            variant="primary"
                            icon="check"
                            disabled={
                              validateResolution(resCode, resNote).length > 0 ||
                              claimsCheck(resNote).length > 0
                            }
                            onClick={() => {
                              if (!resCode) return;
                              update(current.id, (c) =>
                                applyResolve(c, resCode, resNote, ACTOR, now()),
                              );
                              note(`Resolved ${current.ref}: ${RESOLUTION_LABEL[resCode]}`);
                              setResCode(null);
                              setResNote("");
                            }}
                          >
                            Resolve case
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {mode === "escalate" ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Field label="Escalate to" required htmlFor="case-esc">
                          <Select
                            id="case-esc"
                            value={escTo}
                            onChange={(e) => setEscTo(e.target.value)}
                          >
                            <option value="">Choose</option>
                            {ESCALATION_TARGETS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Reason" required htmlFor="case-esc-reason">
                          <TextInput
                            id="case-esc-reason"
                            value={escReason}
                            onChange={(e) => setEscReason(e.target.value)}
                          />
                        </Field>
                        <div className="md:col-span-2">
                          <Button
                            variant="secondary"
                            icon="flag"
                            disabled={validateEscalation(escTo, escReason).length > 0}
                            onClick={() => {
                              update(current.id, (c) =>
                                applyEscalate(c, escTo, escReason, ACTOR, now()),
                              );
                              note(`Escalated ${current.ref} to ${escTo}`);
                              setEscTo("");
                              setEscReason("");
                            }}
                          >
                            Escalate
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Panel>
                )}
              </>
            ) : (
              <EmptyState
                title="Select a case"
                body="Cases past their target are listed first."
                icon="message"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
