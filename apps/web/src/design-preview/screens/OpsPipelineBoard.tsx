"use client";

/**
 * Internal operations: Pipeline board (IA §2.4 `/ops` "Pipeline board: projects by stage; SLA
 * timers"; master spec "Sourcing Pipeline"). Projects by stage with per-stage targets, computed
 * attention reasons, who owes the next move, and operator load. Stages are derived from records
 * and never dragged: a project drawer shows what the next stage needs and who owes each item; the
 * operator records an operator-owned move only when every requirement is met, assigns a lead, and
 * opens the work items behind the card. Local state only.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PIPELINE_STAGES,
  PIPELINE_PROJECTS,
  QUEUE_NOW,
  KIND_LABEL,
  type PipelineProject,
} from "../demo-data/ops-queue";
import { OPERATORS, PROJECT_FACTS, type StageEntry } from "../demo-data/pipeline-board";
import {
  ATTENTION_LABEL,
  OWNER_LABEL,
  assignLead,
  attentionFor,
  boardSummary,
  filterProjects,
  gateFor,
  openTasksFor,
  operatorLoad,
  recordStageChange,
  sortForList,
  stageLabel,
  validateAssignment,
  type BoardFilter,
  type Owner,
} from "../pipeline-demo";
import { slaFor, stageSla } from "../queue-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import { useEscapeKey } from "../ui/useEscapeKey";
import {
  Badge,
  Button,
  buttonClasses,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  TextInput,
  cx,
  type Tone,
} from "../ui/primitives";

type View = "board" | "list";

const TODAY = QUEUE_NOW.slice(0, 10);
const SLA_TONE: Record<string, Tone> = {
  overdue: "danger",
  due_soon: "warn",
  on_track: "neutral",
  buyer_clock: "ink",
};
const OWNER_TONE: Record<Owner, Tone> = {
  operator: "teal",
  buyer: "ink",
  supplier: "neutral",
  compliance: "warn",
};
const BUYERS = [...new Set(PIPELINE_PROJECTS.map((p) => p.buyerOrg))];

function SlaChip({ p }: { p: PipelineProject }) {
  const s = stageSla(p, QUEUE_NOW);
  const stage = PIPELINE_STAGES.find((x) => x.key === p.stage);
  return (
    <Badge
      tone={SLA_TONE[s.state] ?? "neutral"}
      icon={s.state === "overdue" ? "alert" : s.state === "buyer_clock" ? "user" : "clock"}
      className="fbg-num"
    >
      {s.daysInStage} d{stage && stage.slaDays !== null ? ` / ${stage.slaDays} d` : ""}
      {s.state === "buyer_clock"
        ? " · buyer's clock"
        : s.state === "overdue"
          ? " · past target"
          : ""}
    </Badge>
  );
}

export function OpsPipelineBoard({ initialProjectId }: { initialProjectId?: string | undefined }) {
  const [projects, setProjects] = useState<PipelineProject[]>(PIPELINE_PROJECTS);
  const [history, setHistory] = useState<Record<string, StageEntry[]>>(() =>
    Object.fromEntries(Object.entries(PROJECT_FACTS).map(([id, f]) => [id, f.history])),
  );
  const [view, setView] = useState<View>("board");
  const [filter, setFilter] = useState<BoardFilter>({
    operator: "all",
    buyerOrg: "all",
    attentionOnly: false,
  });
  const [openId, setOpenId] = useState<string | null>(
    initialProjectId && PIPELINE_PROJECTS.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : null,
  );
  const [assignTo, setAssignTo] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => boardSummary(projects, QUEUE_NOW), [projects]);
  const shown = useMemo(() => filterProjects(projects, filter, QUEUE_NOW), [projects, filter]);
  const load = useMemo(() => operatorLoad(projects, QUEUE_NOW), [projects]);
  const open = projects.find((p) => p.id === openId) ?? null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const close = () => setOpenId(null);
  useEscapeKey(open !== null, close);
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const openProject = (id: string) => {
    setOpenId(id);
    setAssignTo("");
    setAssignReason("");
  };

  return (
    <AppShell workspace="ops" title="Pipeline">
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="info" title="Stages move from records, not by dragging">
          A project reaches the next stage when its records say so: a confirmed brief, an approved
          RFQ, a reviewed quotation, an evaluated sample, the buyer's written approval. Open a card
          to see what the next stage needs and who owes it.
        </Notice>

        <PageHeader
          title="Pipeline"
          lead="Every sourcing project by stage, with the operator's stage targets, what needs attention, and who owes the next move."
          meta={
            <>
              <Badge
                tone={summary.attention > 0 ? "warn" : "ok"}
                icon={summary.attention > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.attention} need attention
              </Badge>
              <Badge
                tone={summary.pastTarget > 0 ? "danger" : "neutral"}
                icon="clock"
                className="fbg-num"
              >
                {summary.pastTarget} past target
              </Badge>
              <Badge tone="neutral" icon="user" className="fbg-num">
                {summary.unassigned} without a lead
              </Badge>
              <Badge tone={summary.holds > 0 ? "warn" : "neutral"} icon="flag" className="fbg-num">
                {summary.holds} on compliance hold
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                As of {QUEUE_NOW.slice(0, 16).replace("T", " ")} UTC
              </Badge>
            </>
          }
          actions={
            <Link href="/design-preview/ops/queue" className={buttonClasses("secondary")}>
              Work queue
            </Link>
          }
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <SegmentedControl
            label="View"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select
              aria-label="Lead operator"
              value={filter.operator}
              onChange={(e) =>
                setFilter({ ...filter, operator: e.target.value as BoardFilter["operator"] })
              }
            >
              <option value="all">All operators</option>
              {OPERATORS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value="unassigned">Without a lead</option>
            </Select>
            <Select
              aria-label="Buyer organization"
              value={filter.buyerOrg}
              onChange={(e) => setFilter({ ...filter, buyerOrg: e.target.value })}
            >
              <option value="all">All buyers</option>
              {BUYERS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            aria-pressed={filter.attentionOnly}
            onClick={() => setFilter({ ...filter, attentionOnly: !filter.attentionOnly })}
            className={cx(
              "h-9 self-start rounded-(--fbg-radius-control) border px-3 text-sm lg:ml-auto",
              filter.attentionOnly
                ? "border-(--fbg-action-primary) bg-(--fbg-selected)"
                : "border-(--fbg-border-subtle) text-(--fbg-text-secondary)",
            )}
          >
            Needs attention only
          </button>
        </div>

        {view === "board" ? (
          <div className="fbg-scrollbar-thin -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex min-w-max gap-3">
              {PIPELINE_STAGES.map((stage) => {
                const cards = shown.filter((p) => p.stage === stage.key);
                return (
                  <section
                    key={stage.key}
                    aria-label={stage.label}
                    className="flex w-64 shrink-0 flex-col rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-sunken)"
                  >
                    <header className="border-b border-(--fbg-border-subtle) px-3 py-2.5">
                      <p className="flex items-center justify-between text-sm font-medium text-(--fbg-text-primary)">
                        {stage.label}
                        <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                          {cards.length}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-(--fbg-text-secondary)">
                        {stage.slaDays === null
                          ? stage.slaNote
                          : `Target ${stage.slaDays} d · ${stage.slaNote}`}
                      </p>
                    </header>
                    <ul className="flex flex-col gap-2 p-2">
                      {cards.length === 0 ? (
                        <li className="px-1 py-3 text-center text-xs text-(--fbg-text-muted)">
                          No projects
                        </li>
                      ) : null}
                      {cards.map((p) => (
                        <li key={p.id}>
                          <ProjectCard p={p} onOpen={() => openProject(p.id)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <Panel padded={false}>
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {sortForList(shown, QUEUE_NOW).map((p) => {
                const g = gateFor(p);
                const a = attentionFor(p, QUEUE_NOW);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => openProject(p.id)}
                      className="grid w-full gap-2 px-4 py-3 text-left hover:bg-(--fbg-hover) md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:items-center"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-(--fbg-text-primary)">
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-(--fbg-text-secondary)">
                          {p.buyerOrg} · {p.operator ?? "No lead"} · {openTasksFor(p.id).length}{" "}
                          open work item{openTasksFor(p.id).length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral" icon={null}>
                          {stageLabel(p.stage)}
                        </Badge>
                        <SlaChip p={p} />
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {g.waitingOn ? (
                          <Badge tone={OWNER_TONE[g.waitingOn]} icon={null}>
                            Waiting on {OWNER_LABEL[g.waitingOn].toLowerCase()}
                          </Badge>
                        ) : g.canRecord ? (
                          <Badge tone="ok" icon="check">
                            Ready to record
                          </Badge>
                        ) : null}
                        {a.map((x) => (
                          <Badge
                            key={x}
                            tone={x === "past_target" || x === "overdue_task" ? "danger" : "warn"}
                            icon={null}
                          >
                            {ATTENTION_LABEL[x]}
                          </Badge>
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-(--fbg-text-secondary)">
                  No projects match these filters.
                </li>
              ) : null}
            </ul>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Operator load"
            description="Projects led, past target, and open work items on those projects."
            padded={false}
          >
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {load.map((l) => (
                <li
                  key={l.operator}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                >
                  <span className="text-(--fbg-text-primary)">{l.operator}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral" icon="folder" className="fbg-num">
                      {l.projects} projects
                    </Badge>
                    <Badge
                      tone={l.pastTarget > 0 ? "danger" : "neutral"}
                      icon="clock"
                      className="fbg-num"
                    >
                      {l.pastTarget} past target
                    </Badge>
                    <Badge tone="neutral" icon="list" className="fbg-num">
                      {l.openTasks} open work items
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            title="This session"
            description="Assignments and recorded moves are written to the audit trail."
          >
            {log.length === 0 ? (
              <p className="text-sm text-(--fbg-text-secondary)">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
                {log.map((l, i) => (
                  <li key={`${l}-${i}`} className="fbg-num">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close project"
            className="absolute inset-0 bg-black/30"
            onClick={close}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={open.name}
            className="relative flex h-full w-full max-w-(--fbg-drawer-w) flex-col overflow-y-auto border-l border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-5 outline-none sm:max-w-md"
          >
            <ProjectDrawer
              p={open}
              history={history[open.id] ?? []}
              assignTo={assignTo}
              assignReason={assignReason}
              onAssignTo={setAssignTo}
              onAssignReason={setAssignReason}
              onAssign={() => {
                const before = open.operator;
                setProjects((prev) =>
                  prev.map((x) => (x.id === open.id ? assignLead(x, assignTo) : x)),
                );
                note(
                  `${before ? `Reassigned ${open.name} from ${before} to ${assignTo}: ${assignReason.trim()}` : `Assigned ${assignTo} as lead on ${open.name}`}`,
                );
                setAssignTo("");
                setAssignReason("");
              }}
              onRecord={() => {
                const g = gateFor(open);
                const moved = recordStageChange(open, g, TODAY);
                if (moved === open) return;
                setProjects((prev) => prev.map((x) => (x.id === open.id ? moved : x)));
                setHistory((h) => ({
                  ...h,
                  [open.id]: [
                    ...(h[open.id] ?? []),
                    { stage: moved.stage, at: TODAY, by: "Operator (demo)" },
                  ],
                }));
                note(
                  `Recorded ${open.name}: ${stageLabel(open.stage)} → ${stageLabel(moved.stage)}`,
                );
              }}
              onClose={close}
            />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function ProjectCard({ p, onOpen }: { p: PipelineProject; onOpen: () => void }) {
  const g = gateFor(p);
  const a = attentionFor(p, QUEUE_NOW);
  const tasks = openTasksFor(p.id).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-3 text-left hover:border-(--fbg-border-strong)"
    >
      <span className="text-sm font-medium text-(--fbg-text-primary)">{p.name}</span>
      <span className="text-xs text-(--fbg-text-secondary)">{p.buyerOrg}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <SlaChip p={p} />
        {tasks > 0 ? (
          <Badge tone="neutral" icon={null} className="fbg-num">
            {tasks} work item{tasks === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </span>
      {a.length > 0 ? (
        <span className="flex flex-wrap gap-1.5">
          {a.map((x) => (
            <Badge
              key={x}
              tone={x === "past_target" || x === "overdue_task" ? "danger" : "warn"}
              icon={null}
            >
              {ATTENTION_LABEL[x]}
            </Badge>
          ))}
        </span>
      ) : null}
      <span className="text-xs text-(--fbg-text-secondary)">
        {g.canRecord
          ? "Ready to record the next stage"
          : g.waitingOn
            ? `Waiting on ${OWNER_LABEL[g.waitingOn].toLowerCase()}`
            : "Moves on the buyer's action"}{" "}
        · {p.operator ?? "No lead"}
      </span>
    </button>
  );
}

function ProjectDrawer({
  p,
  history,
  assignTo,
  assignReason,
  onAssignTo,
  onAssignReason,
  onAssign,
  onRecord,
  onClose,
}: {
  p: PipelineProject;
  history: StageEntry[];
  assignTo: string;
  assignReason: string;
  onAssignTo: (v: string) => void;
  onAssignReason: (v: string) => void;
  onAssign: () => void;
  onRecord: () => void;
  onClose: () => void;
}) {
  const g = gateFor(p);
  const a = attentionFor(p, QUEUE_NOW);
  const tasks = openTasksFor(p.id);
  const facts = PROJECT_FACTS[p.id];
  const assignErrors = validateAssignment(p, assignTo, assignReason);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">{p.name}</h2>
          <p className="text-xs text-(--fbg-text-secondary)">
            {p.buyerOrg}
            {facts ? ` · ${facts.family}` : ""}
          </p>
        </div>
        <Button size="sm" variant="ghost" aria-label="Close project" onClick={onClose}>
          <Icon name="x" size={16} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="neutral" icon={null}>
          {stageLabel(p.stage)}
        </Badge>
        <SlaChip p={p} />
        {a.map((x) => (
          <Badge
            key={x}
            tone={x === "past_target" || x === "overdue_task" ? "danger" : "warn"}
            icon={null}
          >
            {ATTENTION_LABEL[x]}
          </Badge>
        ))}
      </div>

      {facts?.complianceHoldId ? (
        <Notice tone="warn" icon="flag" title="Compliance hold">
          No supplier work until compliance releases the hold.{" "}
          <Link
            href={`/design-preview/ops/compliance?hold=${facts.complianceHoldId}`}
            className="underline"
          >
            Open the hold
          </Link>
        </Notice>
      ) : null}

      <section aria-label="Next stage">
        <p className="text-xs font-semibold text-(--fbg-text-primary)">To move to {g.nextLabel}</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {g.requirements.map((r) => (
            <li key={r.label} className="flex items-start gap-2">
              <Icon
                name={r.met ? "check" : "clock"}
                size={14}
                className={cx(
                  "mt-0.5 shrink-0",
                  r.met ? "text-(--fbg-status-ok)" : "text-(--fbg-status-warn)",
                )}
              />
              <span className="min-w-0 flex-1 text-(--fbg-text-primary)">{r.label}</span>
              <Badge tone={OWNER_TONE[r.owner]} icon={null}>
                {OWNER_LABEL[r.owner]}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-(--fbg-text-secondary)">{g.explanation}</p>
        {g.canRecord ? (
          <div className="mt-3">
            <Button variant="primary" icon="check" onClick={onRecord}>
              Record move to {g.nextLabel}
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-label="Lead operator" className="border-t border-(--fbg-border-subtle) pt-4">
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Lead operator</p>
        <p className="mt-1 text-sm text-(--fbg-text-primary)">{p.operator ?? "No lead yet"}</p>
        <div className="mt-2 grid gap-2">
          <Select
            aria-label={p.operator ? "Reassign to" : "Assign lead"}
            value={assignTo}
            onChange={(e) => onAssignTo(e.target.value)}
          >
            <option value="">{p.operator ? "Reassign to…" : "Assign a lead…"}</option>
            {OPERATORS.filter((o) => o !== p.operator).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          {p.operator ? (
            <TextInput
              aria-label="Reason for reassigning"
              value={assignReason}
              onChange={(e) => onAssignReason(e.target.value)}
              placeholder="Reason for reassigning"
            />
          ) : null}
          {assignTo && assignErrors.length > 0 ? (
            <p className="text-xs text-(--fbg-status-danger)">{assignErrors.join(" ")}</p>
          ) : null}
          <div>
            <Button size="sm" disabled={assignErrors.length > 0} onClick={onAssign}>
              {p.operator ? "Reassign" : "Assign lead"}
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="Open work items" className="border-t border-(--fbg-border-subtle) pt-4">
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Open work items</p>
        {tasks.length === 0 ? (
          <p className="mt-1 text-sm text-(--fbg-text-secondary)">None.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {tasks.map((t) => {
              const s = slaFor(t.dueAt, QUEUE_NOW);
              return (
                <li key={t.id} className="flex flex-col gap-1">
                  <span className="text-(--fbg-text-primary)">{t.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral" icon={null}>
                      {KIND_LABEL[t.kind]}
                    </Badge>
                    <Badge tone={SLA_TONE[s.state] ?? "neutral"} icon="clock" className="fbg-num">
                      {s.label}
                    </Badge>
                    <Link
                      href={t.href ?? "/design-preview/ops/queue"}
                      className="text-xs text-(--fbg-link) underline"
                    >
                      Open
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Stage history" className="border-t border-(--fbg-border-subtle) pt-4">
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Stage history</p>
        <ol className="mt-2 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
          {history.map((h, i) => (
            <li key={`${h.stage}-${i}`} className="fbg-num">
              {h.at} · {stageLabel(h.stage)} · {h.by}
            </li>
          ))}
        </ol>
        {facts?.projectHref ? (
          <Link href={facts.projectHref} className={cx(buttonClasses("ghost", "sm"), "mt-3")}>
            Open project
          </Link>
        ) : null}
      </section>
    </div>
  );
}
