"use client";

/**
 * Internal operations: Compliance holds (master spec "Compliance Holds" operations module;
 * PRD US-O5 / AC-O5.1; permission matrix row "Compliance holds"). A hold list ordered by urgency,
 * the hold with its trigger, policy basis and evidence, what the buyer sees, internal notes, and a
 * decision form that records who, role, when, reason, conditions and effect. Operators read;
 * compliance reviewers and platform admins decide (a view-as switch demonstrates the gate).
 * Local state only; nothing here changes a brief, a grant or a supplier.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  COMPLIANCE_NOW,
  DEMO_HOLDS,
  HOLD_KIND_LABEL,
  type Hold,
  type Outcome,
} from "../demo-data/ops-compliance";
import {
  BUYER_FACING_TEXT,
  ESCALATION_TARGETS,
  HOLD_STATE_LABEL,
  HOLD_STATE_TONE,
  OUTCOME_LABEL,
  ROLE_LABEL,
  applyDecision,
  canDecide,
  effectOf,
  holdSla,
  holdSummary,
  isDecided,
  sortHolds,
  validateDecision,
  type DecisionInput,
  type ViewRole,
} from "../ops-compliance-demo";
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
  SegmentedControl,
  Select,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";

type Filter = "active" | "decided" | "all";

const EMPTY_DECISION: DecisionInput = {
  outcome: null,
  reason: "",
  conditions: [""],
  escalateTo: null,
};

const SLA_TONE = { overdue: "danger", due_soon: "warn", on_track: "neutral" } as const;

function now(): string {
  return `${COMPLIANCE_NOW.slice(0, 10)} ${new Date().toISOString().slice(11, 16)}`;
}

export function OpsComplianceReview({ initialHoldId }: { initialHoldId?: string | undefined }) {
  const [holds, setHolds] = useState<Hold[]>(DEMO_HOLDS);
  const [role, setRole] = useState<ViewRole>("compliance_reviewer");
  const [filter, setFilter] = useState<Filter>("active");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialHoldId && DEMO_HOLDS.some((h) => h.id === initialHoldId)
      ? initialHoldId
      : (sortHolds(DEMO_HOLDS, COMPLIANCE_NOW)[0]?.id ?? null),
  );
  const [decision, setDecision] = useState<DecisionInput>(EMPTY_DECISION);
  const [noteText, setNoteText] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const summary = useMemo(() => holdSummary(holds, COMPLIANCE_NOW), [holds]);
  const rows = useMemo(
    () =>
      sortHolds(holds, COMPLIANCE_NOW).filter((h) =>
        filter === "all" ? true : filter === "decided" ? isDecided(h.state) : !isDecided(h.state),
      ),
    [holds, filter],
  );
  const hold = holds.find((h) => h.id === selectedId) ?? null;
  const actor =
    role === "platform_admin"
      ? "Platform admin (demo)"
      : role === "compliance_reviewer"
        ? "Compliance (demo)"
        : "Operator (demo)";
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const select = (id: string) => {
    setSelectedId(id);
    setDecision(EMPTY_DECISION);
    setNoteText("");
  };

  const claim = (h: Hold) => {
    setHolds((prev) =>
      prev.map((x) => (x.id === h.id ? { ...x, assignee: actor, state: "under_review" } : x)),
    );
    note(`Claimed “${h.title}” as ${actor}`);
  };

  const addNote = (h: Hold) => {
    if (noteText.trim().length === 0) return;
    const at = now();
    setHolds((prev) =>
      prev.map((x) =>
        x.id === h.id ? { ...x, notes: [...x.notes, { at, by: actor, text: noteText.trim() }] } : x,
      ),
    );
    setNoteText("");
    note(`Internal note added to “${h.title}” (never shown to the buyer)`);
  };

  const record = (h: Hold) => {
    const v = validateDecision(decision, role);
    if (!v.ok || !decision.outcome) return;
    const at = now();
    setHolds((prev) =>
      prev.map((x) => (x.id === h.id ? applyDecision(x, decision, actor, role, at) : x)),
    );
    note(
      `${OUTCOME_LABEL[decision.outcome]} recorded on “${h.title}” by ${actor} (${ROLE_LABEL[role]})${role === "platform_admin" ? " — admin action audited" : ""}`,
    );
    setDecision(EMPTY_DECISION);
    setFilter((f) => (f === "active" ? "all" : f));
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">
          Policy basis and who may decide
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Blocked by default</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Medical devices and gloves, sterile vials, pill presses and encapsulators, ingestibles,
          finished cosmetics, HPLC and export-sensitive machinery. No self-service quoting; a hold
          opens automatically and only a release recorded here lets a brief proceed.
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Who may do what</p>
        <ul className="mt-1 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
          <li>Operators read holds and add internal notes; they cannot decide.</li>
          <li>Compliance reviewers decide: release, release with conditions, decline, escalate.</li>
          <li>Platform admins may decide too; every admin read and action is audited.</li>
          <li>Buyers see only “{BUYER_FACING_TEXT}”. Reasons and notes stay internal.</li>
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Turnaround</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          24 hours from the hold opening (pilot target; not a promise shown to buyers). Escalations
          stop the clock on this screen and start one with the escalation target.
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Actions this session</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            Nothing yet. Decisions and notes are written to the audit trail with your name and role.
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
  );

  return (
    <AppShell workspace="ops" title="Compliance holds" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="lock" title="Internal workspace">
          Holds, reasons and notes never reach buyers or suppliers. A buyer whose brief is on hold
          sees only “{BUYER_FACING_TEXT}”.
        </Notice>

        <PageHeader
          title="Compliance holds"
          lead="Everything the platform stopped for a compliance decision: blocked and out-of-pilot categories, export-sensitive items, contact disclosure grants and supplier provenance. Decide with a recorded reason; the effect of each outcome is stated before you record it."
          meta={
            <>
              <Badge
                tone={summary.overdue > 0 ? "danger" : "ok"}
                icon={summary.overdue > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.overdue} overdue
              </Badge>
              <Badge tone="warn" icon={null} className="fbg-num">
                {summary.open} open
              </Badge>
              <Badge tone="teal" icon={null} className="fbg-num">
                {summary.underReview} under review
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                As of {COMPLIANCE_NOW.slice(0, 16).replace("T", " ")} UTC
              </Badge>
            </>
          }
          actions={
            <div className="flex min-w-0 max-w-full flex-col items-start gap-1">
              <span className="text-xs text-(--fbg-text-secondary)">View as</span>
              <SegmentedControl
                label="View as role"
                size="sm"
                value={role}
                onChange={setRole}
                options={[
                  { value: "operator", label: "Operator" },
                  { value: "compliance_reviewer", label: "Compliance" },
                  { value: "platform_admin", label: "Admin" },
                ]}
              />
            </div>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          {/* Hold list */}
          <div className="flex min-w-0 flex-col gap-2">
            <SegmentedControl
              label="Hold filter"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "active", label: "Active" },
                { value: "decided", label: "Decided" },
                { value: "all", label: "All" },
              ]}
            />
            <Panel padded={false}>
              {rows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No holds here" body="Change the filter." icon="flag" />
                </div>
              ) : (
                <ul className="divide-y divide-(--fbg-border-subtle)">
                  {rows.map((h) => {
                    const sla = holdSla(h, COMPLIANCE_NOW);
                    const active = h.id === selectedId;
                    return (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => select(h.id)}
                          aria-pressed={active}
                          className={cx(
                            "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                            active && "bg-(--fbg-selected)",
                          )}
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <Badge tone={HOLD_STATE_TONE[h.state]} icon={null}>
                              {HOLD_STATE_LABEL[h.state]}
                            </Badge>
                            {sla ? (
                              <Badge
                                tone={SLA_TONE[sla.state]}
                                icon={sla.state === "overdue" ? "alert" : "clock"}
                                className="fbg-num"
                              >
                                {sla.label}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                            {h.title}
                          </span>
                          <span className="truncate text-[11px] text-(--fbg-text-secondary)">
                            {HOLD_KIND_LABEL[h.kind]} · {h.subject.org} ·{" "}
                            {h.assignee ?? "Unassigned"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* Hold detail */}
          <div className="flex min-w-0 flex-col gap-4">
            {hold ? (
              <HoldDetail
                hold={hold}
                role={role}
                actor={actor}
                decision={decision}
                onDecision={setDecision}
                onRecord={() => record(hold)}
                onClaim={() => claim(hold)}
                noteText={noteText}
                onNoteText={setNoteText}
                onAddNote={() => addNote(hold)}
              />
            ) : (
              <EmptyState
                title="Select a hold"
                body="Overdue holds are listed first."
                icon="flag"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function HoldDetail({
  hold,
  role,
  actor,
  decision,
  onDecision,
  onRecord,
  onClaim,
  noteText,
  onNoteText,
  onAddNote,
}: {
  hold: Hold;
  role: ViewRole;
  actor: string;
  decision: DecisionInput;
  onDecision: (d: DecisionInput) => void;
  onRecord: () => void;
  onClaim: () => void;
  noteText: string;
  onNoteText: (v: string) => void;
  onAddNote: () => void;
}) {
  const sla = holdSla(hold, COMPLIANCE_NOW);
  const decided = isDecided(hold.state);
  const validation = validateDecision(decision, role);
  const allowed = canDecide(role);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">{hold.title}</h2>
          <p className="fbg-num text-xs text-(--fbg-text-secondary)">
            {HOLD_KIND_LABEL[hold.kind]} · {hold.subject.org} · opened{" "}
            {hold.createdAt.slice(0, 16).replace("T", " ")} UTC · {hold.assignee ?? "Unassigned"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={HOLD_STATE_TONE[hold.state]} icon={null}>
            {HOLD_STATE_LABEL[hold.state]}
          </Badge>
          {sla ? (
            <Badge
              tone={SLA_TONE[sla.state]}
              icon={sla.state === "overdue" ? "alert" : "clock"}
              className="fbg-num"
            >
              {sla.label}
            </Badge>
          ) : null}
          {hold.subject.href ? (
            <Link href={hold.subject.href} className={buttonClasses("ghost", "sm")}>
              Open record
            </Link>
          ) : null}
          {!decided && hold.state === "open" && allowed ? (
            <Button size="sm" onClick={onClaim}>
              Claim
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <Panel title="Why it is on hold">
          <p className="text-sm text-(--fbg-text-primary)">{hold.trigger}</p>
          <p className="mt-2 text-xs text-(--fbg-text-secondary)">Policy basis: {hold.policyRef}</p>
          <p className="mt-2 text-xs text-(--fbg-text-secondary)">Subject: {hold.subject.label}</p>
        </Panel>
        <Panel title="What the buyer or supplier sees">
          <div className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-3 text-sm text-(--fbg-text-primary)">
            {BUYER_FACING_TEXT}
          </div>
          <p className="mt-2 text-xs text-(--fbg-text-secondary)">
            Only this sentence, plus any plain-language note you choose to send through the
            operator. Your reasons, conditions and internal notes stay in this workspace.
          </p>
        </Panel>
      </div>

      <Panel title="Evidence" padded={false}>
        <div className="px-5 py-4">
          <KeyValue
            columns={2}
            items={hold.evidence.map((e) => ({ label: e.label, value: e.value }))}
          />
        </div>
      </Panel>

      <Panel
        title="Internal notes"
        description="Visible to operators, compliance and admins. Never to buyers or suppliers."
        padded={false}
      >
        {hold.notes.length === 0 ? (
          <p className="px-5 py-3 text-sm text-(--fbg-text-secondary)">No notes yet.</p>
        ) : (
          <ol className="divide-y divide-(--fbg-border-subtle)">
            {hold.notes.map((n, i) => (
              <li key={`${n.at}-${i}`} className="px-5 py-3 text-sm">
                <p className="text-(--fbg-text-primary)">{n.text}</p>
                <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                  {n.by} · {n.at}
                </p>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-col gap-2 border-t border-(--fbg-border-subtle) px-5 py-3 sm:flex-row sm:items-start">
          <TextArea
            aria-label="Add an internal note"
            rows={2}
            value={noteText}
            onChange={(e) => onNoteText(e.target.value)}
            placeholder={`Note as ${actor}`}
            className="sm:flex-1"
          />
          <Button size="sm" disabled={noteText.trim().length === 0} onClick={onAddNote}>
            Add note
          </Button>
        </div>
      </Panel>

      {decided && hold.decision ? (
        <Panel title="Decision">
          <Notice
            tone={
              hold.decision.outcome === "declined"
                ? "danger"
                : hold.decision.outcome === "escalated"
                  ? "neutral"
                  : "ok"
            }
            title={`${OUTCOME_LABEL[hold.decision.outcome]}${hold.decision.escalateTo ? ` to ${hold.decision.escalateTo}` : ""} — ${hold.decision.by} (${ROLE_LABEL[hold.decision.role]}), ${hold.decision.at}`}
          >
            {hold.decision.reason}
          </Notice>
          {hold.decision.conditions.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-(--fbg-text-primary)">Conditions</p>
              <ol className="mt-1 list-decimal pl-5 text-sm text-(--fbg-text-primary)">
                {hold.decision.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-(--fbg-text-secondary)">
            Effect: {effectOf(hold.kind, hold.decision.outcome)}
          </p>
        </Panel>
      ) : (
        <Panel
          title="Record a decision"
          description={
            allowed
              ? "The outcome, your name and role, the time, the reason and any conditions are written to the audit trail. The effect is stated before you record it."
              : `Viewing as ${ROLE_LABEL[role]}: operators read holds and add notes; only a compliance reviewer or platform admin can record a decision.`
          }
        >
          <fieldset disabled={!allowed} className="flex min-w-0 flex-col gap-4 disabled:opacity-70">
            <div role="radiogroup" aria-label="Outcome" className="grid gap-2">
              {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                <label
                  key={o}
                  className={cx(
                    "flex cursor-pointer items-start gap-2 rounded-(--fbg-radius-control) border p-3",
                    decision.outcome === o
                      ? "border-(--fbg-action-primary)/60 bg-(--fbg-selected)"
                      : "border-(--fbg-border-subtle) hover:border-(--fbg-border-strong)",
                  )}
                >
                  <input
                    type="radio"
                    name="outcome"
                    className="mt-0.5 accent-(--fbg-action-primary)"
                    checked={decision.outcome === o}
                    onChange={() => onDecision({ ...decision, outcome: o })}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-(--fbg-text-primary)">
                      {OUTCOME_LABEL[o]}
                    </span>
                    <span className="block text-xs text-(--fbg-text-secondary)">
                      {effectOf(hold.kind, o)}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div>
              <label
                htmlFor="decision-reason"
                className="text-xs font-semibold text-(--fbg-text-primary)"
              >
                Reason (audit record)
              </label>
              <TextArea
                id="decision-reason"
                rows={3}
                value={decision.reason}
                onChange={(e) => onDecision({ ...decision, reason: e.target.value })}
                placeholder="State the policy basis and the facts that decide it. At least 20 characters."
              />
            </div>

            {decision.outcome === "released_with_conditions" ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-(--fbg-text-primary)">Conditions</p>
                {decision.conditions.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <TextInput
                      aria-label={`Condition ${i + 1}`}
                      value={c}
                      onChange={(e) =>
                        onDecision({
                          ...decision,
                          conditions: decision.conditions.map((x, j) =>
                            j === i ? e.target.value : x,
                          ),
                        })
                      }
                      placeholder="For example: test report for the exact material before a sample"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove condition ${i + 1}`}
                      onClick={() =>
                        onDecision({
                          ...decision,
                          conditions: decision.conditions.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Icon name="x" size={14} />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="plus"
                    onClick={() =>
                      onDecision({ ...decision, conditions: [...decision.conditions, ""] })
                    }
                  >
                    Add condition
                  </Button>
                </div>
              </div>
            ) : null}

            {decision.outcome === "escalated" ? (
              <div>
                <label
                  htmlFor="escalate-to"
                  className="text-xs font-semibold text-(--fbg-text-primary)"
                >
                  Escalate to
                </label>
                <Select
                  id="escalate-to"
                  value={decision.escalateTo ?? ""}
                  onChange={(e) => onDecision({ ...decision, escalateTo: e.target.value || null })}
                  className="sm:w-80"
                >
                  <option value="">Choose</option>
                  {ESCALATION_TARGETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {decision.outcome ? (
              <Notice tone="neutral" title="Effect of recording this">
                {effectOf(hold.kind, decision.outcome)}
              </Notice>
            ) : null}

            {validation.errors.length > 0 && (decision.outcome || decision.reason.length > 0) ? (
              <ul className="flex flex-col gap-0.5 text-xs text-(--fbg-status-danger)">
                {validation.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" icon="check" disabled={!validation.ok} onClick={onRecord}>
                Record decision
              </Button>
              <span className="text-xs text-(--fbg-text-secondary)">
                as {actor}
                {role === "platform_admin" ? " · admin actions are audited" : ""}
              </span>
            </div>
          </fieldset>
        </Panel>
      )}
    </>
  );
}
