"use client";

/**
 * Operations work queue and pipeline (IA §2.4 `/ops`; brief: Work queue). Everything waiting on an operator,
 * ordered by SLA, with claim and inline outbound approval; a pipeline board of projects by stage with per-stage
 * targets. Local state only; synthetic data. SLA targets are a pilot proposal, not a promise.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  KIND_LABEL,
  PIPELINE_PROJECTS,
  PIPELINE_STAGES,
  QUEUE_NOW,
  QUEUE_TASKS,
  SLA_HOURS,
  type Assignee,
  type QueueTask,
  type TaskKind,
} from "../demo-data/ops-queue";
import { queueSummary, slaFor, sortByUrgency, stageSla, type SlaState } from "../queue-demo";
import { AppShell } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import {
  Badge,
  Button,
  Notice,
  PageHeader,
  Panel,
  Select,
  Tabs,
  buttonClasses,
  cx,
  type Tone,
} from "../ui/primitives";

type Tab = "mine" | "unassigned" | "all" | "pipeline";

const SLA_TONE: Record<SlaState | "buyer_clock", Tone> = {
  overdue: "danger",
  due_soon: "warn",
  on_track: "neutral",
  buyer_clock: "ink",
};

const KIND_ICON: Record<TaskKind, IconName> = {
  extraction_review: "eye",
  outreach_approval: "message",
  clarification_relay: "message",
  check_due: "shield",
  intake_permission: "lock",
  compliance_hold: "flag",
  buyer_case: "user",
  quote_expiring: "clock",
};

const ASSIGNEE_LABEL: Record<Assignee, string> = {
  me: "You",
  other: "Another operator",
  unassigned: "Unassigned",
};

function SlaChip({ dueAt }: { dueAt: string }) {
  const s = slaFor(dueAt, QUEUE_NOW);
  return (
    <Badge
      tone={SLA_TONE[s.state]}
      icon={s.state === "overdue" ? "alert" : "clock"}
      className="fbg-num whitespace-nowrap"
    >
      {s.label}
    </Badge>
  );
}

export function OpsWorkQueue() {
  const [tab, setTab] = useState<Tab>("mine");
  const [tasks, setTasks] = useState<QueueTask[]>(QUEUE_TASKS);
  const [kind, setKind] = useState<TaskKind | "all">("all");
  const [project, setProject] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const summary = queueSummary(tasks, QUEUE_NOW);
  const projects = Array.from(
    new Map(tasks.filter((t) => t.project).map((t) => [t.project!.id, t.project!.name])).entries(),
  );

  const rows = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (tab === "mine" && t.assignee !== "me") return false;
      if (tab === "unassigned" && t.assignee !== "unassigned") return false;
      if (kind !== "all" && t.kind !== kind) return false;
      if (project !== "all" && t.project?.id !== project) return false;
      return true;
    });
    return sortByUrgency(filtered, QUEUE_NOW);
  }, [tasks, tab, kind, project]);

  const patch = (id: string, p: Partial<QueueTask>) =>
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const claim = (t: QueueTask) => {
    patch(t.id, { assignee: "me", assigneeName: "Operator (demo)", status: "in_progress" });
    setLog((l) => [`${QUEUE_NOW.slice(11, 16)} Claimed “${t.title}”`, ...l]);
  };
  const approveAndSend = (t: QueueTask) => {
    patch(t.id, { status: "done" });
    setOpen(null);
    setLog((l) => [
      `${QUEUE_NOW.slice(11, 16)} Approved and sent via platform: “${t.title}” (buyer approval ${t.draft?.buyerApprovedAt}; operator Operator (demo); channel logged)`,
      ...l,
    ]);
  };
  const returnToBuyer = (t: QueueTask) => {
    patch(t.id, { status: "done" });
    setOpen(null);
    setLog((l) => [
      `${QUEUE_NOW.slice(11, 16)} Returned draft to buyer with a note: “${t.title}”`,
      ...l,
    ]);
  };
  const relay = (t: QueueTask) => {
    patch(t.id, { status: "done" });
    setLog((l) => [
      `${QUEUE_NOW.slice(11, 16)} Relayed supplier reply to buyer; quotation version created: “${t.title}”`,
      ...l,
    ]);
  };

  const rightRail = (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <h2 className="text-[15px] font-semibold text-(--fbg-text-primary)">
          Targets and your log
        </h2>
      </div>
      <div>
        <p className="text-xs font-medium text-(--fbg-text-primary)">
          Turnaround targets (pilot proposal)
        </p>
        <ul className="mt-1.5 flex flex-col gap-1 text-sm">
          {(Object.keys(SLA_HOURS) as TaskKind[]).map((k) => (
            <li key={k} className="flex items-center justify-between gap-2">
              <span className="text-(--fbg-text-secondary)">{KIND_LABEL[k]}</span>
              <span className="fbg-num text-(--fbg-text-primary)">{SLA_HOURS[k]} h</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-(--fbg-text-secondary)">
          Targets guide ordering only; they are not shown to buyers as promises.
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-(--fbg-text-primary)">Actions this session</p>
        {log.length === 0 ? (
          <p className="mt-1 text-sm text-(--fbg-text-secondary)">
            Nothing yet. Every action here is written to the audit trail with your name.
          </p>
        ) : (
          <ol className="mt-1 flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
            {log.map((e, i) => (
              <li key={i} className="fbg-num">
                {e}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );

  return (
    <AppShell workspace="ops" title="Work queue" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Work queue"
          lead="Everything waiting on an operator, across projects and suppliers, ordered by how soon it is due. Approvals here are recorded with your name; nothing reaches a supplier without them."
          meta={
            <>
              <Badge tone="neutral" icon={null} className="fbg-num">
                {summary.open} open
              </Badge>
              <Badge
                tone={summary.overdue > 0 ? "danger" : "ok"}
                icon={summary.overdue > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.overdue} overdue
              </Badge>
              <Badge tone="warn" icon="clock" className="fbg-num">
                {summary.dueSoon} due within 24 h
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                As of {QUEUE_NOW.replace("T", " ").slice(0, 16)} UTC
              </Badge>
            </>
          }
          actions={
            <Link href="/design-preview/ops/quote-review" className={buttonClasses("secondary")}>
              <Icon name="eye" size={16} /> Review queue
            </Link>
          }
        />

        <Tabs
          label="Queue views"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "mine", label: "My queue", count: summary.mine },
            { value: "unassigned", label: "Unassigned", count: summary.unassigned },
            { value: "all", label: "All open", count: summary.open },
            { value: "pipeline", label: "Pipeline", count: PIPELINE_PROJECTS.length },
          ]}
        />

        {tab !== "pipeline" ? (
          <Panel padded={false}>
            <div className="flex flex-col gap-2 border-b border-(--fbg-border-subtle) p-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Select
                aria-label="Task kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as TaskKind | "all")}
                className="min-w-0 sm:max-w-64 sm:flex-1 sm:basis-52"
              >
                <option value="all">All kinds</option>
                {(Object.keys(KIND_LABEL) as TaskKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="min-w-0 sm:max-w-80 sm:flex-1 sm:basis-64"
              >
                <option value="all">All projects</option>
                {projects.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
              <span className="fbg-num text-xs whitespace-nowrap text-(--fbg-text-secondary) sm:ml-auto">
                {rows.length} shown · overdue first
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-(--fbg-text-secondary)">
                Nothing in this view. Switch tabs or clear the filters.
              </p>
            ) : (
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {rows.map((t) => {
                  const expanded = open === t.id;
                  return (
                    <li
                      key={t.id}
                      className={cx("px-4 py-3 sm:px-5", t.status === "done" && "opacity-60")}
                    >
                      <div className="flex flex-col gap-2 md:grid md:grid-cols-[8rem_1fr_auto] md:items-start md:gap-4">
                        <div className="flex items-center gap-2 md:flex-col md:items-start">
                          <SlaChip dueAt={t.dueAt} />
                          {t.status === "done" ? (
                            <Badge tone="ok">Done</Badge>
                          ) : t.status === "in_progress" ? (
                            <Badge tone="teal" icon={null}>
                              In progress
                            </Badge>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-(--fbg-text-primary)">
                            <Icon
                              name={KIND_ICON[t.kind]}
                              size={14}
                              className="shrink-0 text-(--fbg-text-secondary)"
                            />
                            {t.title}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--fbg-text-secondary)">
                            <Badge tone="neutral" icon={null}>
                              {KIND_LABEL[t.kind]}
                            </Badge>
                            {t.project ? (
                              <span>
                                {t.project.name} · {t.project.buyerOrg}
                              </span>
                            ) : null}
                            {t.supplier ? <span>· {t.supplier.name}</span> : null}
                            <span>
                              · {ASSIGNEE_LABEL[t.assignee]}
                              {t.assigneeName && t.assignee === "other"
                                ? ` (${t.assigneeName})`
                                : ""}
                            </span>
                          </p>
                          {t.note ? (
                            <p className="mt-1 text-xs text-(--fbg-text-secondary)">{t.note}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {t.status === "done" ? null : t.kind === "compliance_hold" && t.href ? (
                            <Link href={t.href} className={buttonClasses("secondary", "sm")}>
                              Open hold
                            </Link>
                          ) : t.assignee === "unassigned" ? (
                            <Button
                              size="sm"
                              variant="primary"
                              icon="user"
                              onClick={() => claim(t)}
                            >
                              Claim
                            </Button>
                          ) : t.kind === "outreach_approval" && t.assignee === "me" ? (
                            <Button
                              size="sm"
                              variant={expanded ? "secondary" : "primary"}
                              icon="message"
                              onClick={() => setOpen(expanded ? null : t.id)}
                              aria-expanded={expanded}
                            >
                              {expanded ? "Hide draft" : "Review draft"}
                            </Button>
                          ) : t.kind === "clarification_relay" && t.assignee === "me" ? (
                            <Button
                              size="sm"
                              variant="primary"
                              icon="check"
                              onClick={() => relay(t)}
                            >
                              Relay to buyer
                            </Button>
                          ) : t.href ? (
                            <Link href={t.href} className={buttonClasses("secondary", "sm")}>
                              Open
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              disabled
                              title="Handled on its own screen (not in this prototype)"
                            >
                              Open
                            </Button>
                          )}
                        </div>
                      </div>

                      {expanded && t.draft ? (
                        <div className="mt-3 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-4">
                          <p className="text-xs font-medium text-(--fbg-text-primary)">
                            Outbound message — approval chain
                          </p>
                          <ol className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <li className="inline-flex items-center gap-1 rounded-(--fbg-radius-chip) border border-(--fbg-status-success)/35 bg-(--fbg-status-success-fill) px-2 py-0.5 text-(--fbg-status-success)">
                              <Icon name="check" size={12} /> Buyer approved{" "}
                              <span className="fbg-num">{t.draft.buyerApprovedAt}</span>
                            </li>
                            <Icon
                              name="chevron-right"
                              size={12}
                              className="text-(--fbg-text-muted)"
                            />
                            <li className="inline-flex items-center gap-1 rounded-(--fbg-radius-chip) border border-(--fbg-status-warning)/40 bg-(--fbg-status-warning-fill) px-2 py-0.5 text-(--fbg-status-warning)">
                              <Icon name="clock" size={12} /> Operator: you
                            </li>
                            <Icon
                              name="chevron-right"
                              size={12}
                              className="text-(--fbg-text-muted)"
                            />
                            <li className="inline-flex items-center gap-1 rounded-(--fbg-radius-chip) border border-(--fbg-border-subtle) px-2 py-0.5 text-(--fbg-text-secondary)">
                              <Icon name="lock" size={12} /> Sent via platform
                            </li>
                          </ol>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-3 text-sm">
                              <p className="text-xs text-(--fbg-text-secondary)">
                                English (buyer's wording)
                              </p>
                              <p className="mt-1 text-(--fbg-text-primary)">{t.draft.en}</p>
                            </div>
                            <div className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-3 text-sm">
                              <p className="text-xs text-(--fbg-text-secondary)">
                                中文（发送给供应商）
                              </p>
                              <p className="fbg-zh mt-1 text-(--fbg-text-primary)" lang="zh-CN">
                                {t.draft.zh}
                              </p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-(--fbg-text-secondary)">
                            Channel: {t.draft.channel}. The outbound record logs channel, approver,
                            time and message text; the supplier's reply creates a new quotation
                            version.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              icon="check"
                              onClick={() => approveAndSend(t)}
                            >
                              Approve and send via platform
                            </Button>
                            <Button size="sm" onClick={() => returnToBuyer(t)}>
                              Return to buyer with a note
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ) : (
          <div className="flex flex-col gap-3">
            <Notice tone="neutral" icon="info" title="Stage targets apply to operator steps only">
              Brief drafting, the comparison decision and the final approval run on the buyer's
              clock; those columns show days in stage without a target.{" "}
              <Link href="/design-preview/ops/pipeline" className="underline">
                Open the full pipeline board
              </Link>{" "}
              for what each stage needs, who owes it, and operator load.
            </Notice>
            <div className="fbg-scrollbar-thin -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="flex min-w-max gap-3">
                {PIPELINE_STAGES.map((stage) => {
                  const cards = PIPELINE_PROJECTS.filter((p) => p.stage === stage.key);
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
                        {cards.map((p) => {
                          const s = stageSla(p, QUEUE_NOW);
                          return (
                            <li
                              key={p.id}
                              className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-3"
                            >
                              {p.id === "prj_demo_labels" ? (
                                <Link
                                  href="/design-preview/buyer/project"
                                  className="text-sm font-medium text-(--fbg-text-primary) hover:text-(--fbg-link) hover:underline"
                                >
                                  {p.name}
                                </Link>
                              ) : (
                                <p className="text-sm font-medium text-(--fbg-text-primary)">
                                  {p.name}
                                </p>
                              )}
                              <p className="mt-0.5 text-xs text-(--fbg-text-secondary)">
                                {p.buyerOrg}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Badge
                                  tone={SLA_TONE[s.state]}
                                  icon={
                                    s.state === "overdue"
                                      ? "alert"
                                      : s.state === "buyer_clock"
                                        ? "user"
                                        : "clock"
                                  }
                                  className="fbg-num"
                                >
                                  {s.daysInStage} d in stage
                                  {s.state === "buyer_clock"
                                    ? " · buyer"
                                    : s.state === "overdue"
                                      ? " · past target"
                                      : ""}
                                </Badge>
                                {p.openTasks > 0 ? (
                                  <Badge tone="neutral" icon={null} className="fbg-num">
                                    {p.openTasks} task{p.openTasks === 1 ? "" : "s"}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1.5 text-xs text-(--fbg-text-secondary)">
                                {p.operator ?? "Unassigned — claim from the queue"}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
