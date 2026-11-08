"use client";

/**
 * Buyer: Samples & Inspections (IA §2.2 `/app/projects/[id]/qa`; master spec §6.7; QUALITY_ASSURANCE
 * §1, §3–§5, §7). Per supplier track: what was checked, by whom, when, against which checklist
 * version, in the fixed badge wording; the eight steps in the buyer's words; samples, the golden
 * sample agreement, production milestones with estimated vs committed dates, inspections with
 * findings and the limits of sampling; and the decision after a failed inspection, which is the
 * buyer's. Supplier contact data never appears. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BUYER_DECISION_LABEL,
  INSPECTION_TYPE_LABEL,
  LOTS,
  QUALITY_TODAY,
  SAMPLE_KIND_LABEL,
  type BuyerDecision,
} from "../demo-data/quality";
import {
  buyerQaSummary,
  buyerStepText,
  buyerTracks,
  decisionConsequence,
  decisionLabel,
  decisionNeeded,
  evidenceFor,
  samplingLimits,
  validateDecision,
  type DecisionInput,
} from "../buyer-qa-demo";
import { inspectionBadge, type StepState, type TrackView } from "../quality-demo";
import { AppShell } from "../ui/AppShell";
import {
  Badge,
  Button,
  buttonClasses,
  Checkbox,
  EmptyState,
  EvidenceBadge,
  Field,
  Notice,
  PageHeader,
  Panel,
  TextArea,
  cx,
  type Tone,
} from "../ui/primitives";

const PROJECT_ID = "prj_demo_labels";
const STEP_TONE: Record<StepState, Tone> = {
  done: "ok",
  current: "teal",
  pending: "neutral",
  blocked: "warn",
  not_needed: "neutral",
};
const STEP_LABEL: Record<StepState, string> = {
  done: "Done",
  current: "In progress",
  pending: "Later",
  blocked: "Waiting",
  not_needed: "Not needed",
};
const EMPTY: DecisionInput = { decision: null, note: "", acknowledged: false };

export function BuyerQaStatus({ initialTrackId }: { initialTrackId?: string | undefined }) {
  const views = useMemo(() => buyerTracks(PROJECT_ID, QUALITY_TODAY), []);
  const [decided, setDecided] = useState<
    Record<string, { decision: BuyerDecision; note: string; at: string }>
  >({});
  const [selectedId, setSelectedId] = useState<string>(
    initialTrackId && views.some((v) => v.track.id === initialTrackId)
      ? initialTrackId
      : (views.find((v) => decisionNeeded(v, false))?.track.id ?? views[0]?.track.id ?? ""),
  );
  const [input, setInput] = useState<DecisionInput>(EMPTY);
  const [log, setLog] = useState<string[]>([]);
  const decidedSet = useMemo(() => new Set(Object.keys(decided)), [decided]);
  const summary = useMemo(() => buyerQaSummary(views, decidedSet), [views, decidedSet]);
  const view = views.find((v) => v.track.id === selectedId) ?? null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const record = (v: TrackView) => {
    if (validateDecision(input).length > 0 || !input.decision) return;
    const at = `${QUALITY_TODAY} ${new Date().toISOString().slice(11, 16)}`;
    setDecided((d) => ({
      ...d,
      [v.track.id]: { decision: input.decision!, note: input.note.trim(), at },
    }));
    note(
      `Your decision "${decisionLabel(input.decision)}" on ${v.track.supplier.name} was recorded and sent to Factory Bridge to relay.`,
    );
    setInput(EMPTY);
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">
          What a badge means here
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>
          Every badge says what was checked, by whom, when and against which checklist version. Open
          one to see it.
        </li>
        <li>
          An approved sample shows the supplier can make it. A passed inspection shows a sample of
          one lot met an acceptance rule with a stated statistical risk. Neither means "zero
          defects".
        </li>
        <li>
          A lot result belongs to that lot only. It never carries to the supplier or to another lot.
        </li>
        <li>
          After a failed inspection the decision is yours. Factory Bridge records its recommendation
          and relays your decision; it cannot physically hold a shipment.
        </li>
        <li>Supplier contact details are not shown here; messages go through the platform.</li>
      </ul>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Your actions this session</p>
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
    <AppShell workspace="buyer" title="Quality" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Samples and inspections"
          lead="Exactly what was checked for each supplier on this project, by whom, when and against which checklist version. Decisions after a failed inspection are yours."
          meta={
            <>
              <Badge
                tone={summary.decisions > 0 ? "danger" : "ok"}
                icon={summary.decisions > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.decisions} decision{summary.decisions === 1 ? "" : "s"} waiting for you
              </Badge>
              <Badge tone="teal" icon="clock" className="fbg-num">
                {summary.scheduled} inspection{summary.scheduled === 1 ? "" : "s"} scheduled
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                As of {QUALITY_TODAY}
              </Badge>
            </>
          }
          actions={
            <>
              <Link href="/design-preview/buyer/project" className={buttonClasses("secondary")}>
                Project
              </Link>
              <Link
                href="/design-preview/buyer/messages?thread=th_sample"
                className={buttonClasses("ghost")}
              >
                Sample thread
              </Link>
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold text-(--fbg-text-primary)">
              Suppliers on this project
            </p>
            <Panel padded={false}>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {views.map((v) => {
                  const active = v.track.id === selectedId;
                  const needs = decisionNeeded(v, decidedSet.has(v.track.id));
                  const current = [...v.steps].reverse().find((s) => s.state === "current");
                  return (
                    <li key={v.track.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(v.track.id);
                          setInput(EMPTY);
                        }}
                        aria-pressed={active}
                        className={cx(
                          "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                          active && "bg-(--fbg-selected)",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          {needs ? (
                            <Badge tone="danger" icon="alert">
                              Your decision needed
                            </Badge>
                          ) : current ? (
                            <Badge tone="teal" icon={null}>
                              {current.label}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                          {v.track.supplier.name}
                        </span>
                        <span className="truncate text-[11px] text-(--fbg-text-secondary)">
                          {v.track.variant}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {view ? (
              <TrackDetail
                view={view}
                decided={decided[view.track.id] ?? null}
                input={input}
                onInput={setInput}
                onRecord={() => record(view)}
              />
            ) : (
              <EmptyState
                title="Select a supplier"
                body="Suppliers with a decision waiting are listed first."
                icon="shield"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TrackDetail({
  view,
  decided,
  input,
  onInput,
  onRecord,
}: {
  view: TrackView;
  decided: { decision: BuyerDecision; note: string; at: string } | null;
  input: DecisionInput;
  onInput: (v: DecisionInput) => void;
  onRecord: () => void;
}) {
  const { track, qsr } = view;
  const evidence = evidenceFor(view);
  const needs = decisionNeeded(view, decided !== null);
  const errors = validateDecision(input);
  const failedJob = view.jobs.find((j) => j.result?.result === "fail") ?? null;
  const failedLot = failedJob ? LOTS.find((l) => l.id === failedJob.lotId) : null;
  const openCase = view.cases.find((c) => c.status !== "closed") ?? null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">
            {track.supplier.name}
          </h2>
          <p className="text-xs text-(--fbg-text-secondary)">{track.variant}</p>
        </div>
        <Badge
          tone={needs ? "danger" : view.releaseRecommendation === "recommended" ? "ok" : "neutral"}
          icon={needs ? "alert" : view.releaseRecommendation === "recommended" ? "check" : "clock"}
        >
          {needs
            ? "Inspection failed: your decision is needed"
            : decided
              ? `Your decision: ${decisionLabel(decided.decision)}`
              : view.releaseRecommendation === "recommended"
                ? "Release recommended by Factory Bridge"
                : "No release recommendation yet"}
        </Badge>
      </div>

      <Panel
        title="What has been checked"
        description="Open a badge to see what was checked, by whom and when."
      >
        <div className="flex flex-wrap gap-2 [&_summary_*]:whitespace-normal [&_summary_*]:text-left">
          {evidence.map((e) => (
            <EvidenceBadge key={e.label} label={e.label} tone={e.tone} evidence={e.evidence} />
          ))}
        </div>
      </Panel>

      <Panel title="Where this supplier stands" padded={false}>
        <ol className="grid divide-y divide-(--fbg-border-subtle) md:grid-cols-2 md:divide-y-0 2xl:grid-cols-4">
          {view.steps.map((s, i) => (
            <li
              key={s.key}
              className="flex flex-col gap-1 px-4 py-3 md:border-b md:border-(--fbg-border-subtle)"
            >
              <span className="flex items-center gap-2">
                <span className="fbg-num text-xs text-(--fbg-text-secondary)">{i + 1}</span>
                <span className="text-sm font-medium text-(--fbg-text-primary)">{s.label}</span>
                <Badge tone={STEP_TONE[s.state]} icon={s.state === "done" ? "check" : null}>
                  {STEP_LABEL[s.state]}
                </Badge>
              </span>
              <span className="text-xs text-(--fbg-text-secondary)">
                {buyerStepText(view, s.key)}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {needs && failedJob?.result && failedLot ? (
        <Panel
          title={`Your decision on lot ${failedLot.lotCode}`}
          description="Factory Bridge does not recommend releasing this lot. The decision is yours; it is recorded under your name and relayed to the supplier through the platform."
        >
          <ul className="mb-4 flex flex-col gap-1 text-sm text-(--fbg-text-primary)">
            {samplingLimits(failedJob, failedLot.quantity, qsr.samplingPlan.aqlMajor).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div role="radiogroup" aria-label="Your decision" className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(BUYER_DECISION_LABEL) as BuyerDecision[]).map((d) => (
              <label
                key={d}
                className={cx(
                  "flex cursor-pointer items-start gap-2 rounded-(--fbg-radius-control) border p-3",
                  input.decision === d
                    ? "border-(--fbg-action-primary)/60 bg-(--fbg-selected)"
                    : "border-(--fbg-border-subtle) hover:border-(--fbg-border-strong)",
                )}
              >
                <input
                  type="radio"
                  name="qa-decision"
                  className="mt-0.5 accent-(--fbg-action-primary)"
                  checked={input.decision === d}
                  onChange={() => onInput({ ...input, decision: d })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-(--fbg-text-primary)">
                    {BUYER_DECISION_LABEL[d]}
                  </span>
                  <span className="block text-xs text-(--fbg-text-secondary)">
                    {decisionConsequence(d)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <Field
              label="Note to the supplier (relayed by Factory Bridge)"
              htmlFor="qa-note"
              hint={
                input.decision === "partial"
                  ? "Required for partial acceptance: which units or criteria."
                  : undefined
              }
            >
              <TextArea
                id="qa-note"
                rows={2}
                value={input.note}
                onChange={(e) => onInput({ ...input, note: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Checkbox
              id="qa-ack"
              label="I have read what this inspection did and did not cover."
              checked={input.acknowledged}
              onChange={(on) => onInput({ ...input, acknowledged: on })}
            />
          </div>
          {errors.length > 0 && (input.decision || input.acknowledged) ? (
            <ul className="mt-2 text-xs text-(--fbg-status-danger)">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" icon="check" disabled={errors.length > 0} onClick={onRecord}>
              Record my decision
            </Button>
            <span className="text-xs text-(--fbg-text-secondary)">
              Sent to Factory Bridge to relay; you can follow it in Messages.
            </span>
          </div>
        </Panel>
      ) : null}

      {decided ? (
        <Notice tone="ok" icon="check" title={`Your decision: ${decisionLabel(decided.decision)}`}>
          Recorded {decided.at} under your name
          {decided.note ? ` with the note “${decided.note}”` : ""}. Factory Bridge relays it to the
          supplier; the next step appears in Messages.{" "}
          <Link href="/design-preview/buyer/messages" className="underline">
            Open Messages
          </Link>
        </Notice>
      ) : null}

      <div className="grid gap-4 2xl:grid-cols-2">
        <Panel title="Samples" padded={false}>
          <ul className="divide-y divide-(--fbg-border-subtle)">
            {view.samples.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-(--fbg-text-primary)">
                    {SAMPLE_KIND_LABEL[s.kind]}
                  </span>
                  <Badge
                    tone={s.result === "pass" ? "ok" : s.result === "fail" ? "danger" : "neutral"}
                    icon={null}
                  >
                    {s.result === "pass"
                      ? "Passed"
                      : s.result === "fail"
                        ? "Did not pass"
                        : "Pending"}
                  </Badge>
                </span>
                <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                  Requested {s.requestedAt} · received {s.receivedAt ?? "—"} · evaluated by{" "}
                  {s.evaluatedBy ?? "—"}
                </span>
                <span className="text-xs text-(--fbg-text-secondary)">{s.note}</span>
                {s.evidenceDocuments.length > 0 ? (
                  <span className="text-xs text-(--fbg-text-secondary)">
                    Evidence in Documents: {s.evidenceDocuments.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
            {view.samples.length === 0 ? (
              <li className="px-5 py-3 text-sm text-(--fbg-text-secondary)">No samples yet.</li>
            ) : null}
          </ul>
        </Panel>
        <Panel
          title="Production"
          description="As reported by the supplier. Estimated dates are not commitments."
          padded={false}
        >
          {track.milestones.length === 0 ? (
            <p className="px-5 py-3 text-sm text-(--fbg-text-secondary)">
              Production has not started.
            </p>
          ) : (
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {track.milestones.map((m) => (
                <li
                  key={m.key}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"
                >
                  <span className="text-(--fbg-text-primary)">{m.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                      {m.value ? `${m.value} · ` : ""}
                      {m.date ?? "—"}
                    </span>
                    <Badge
                      tone={
                        m.dateKind === "committed"
                          ? "ok"
                          : m.dateKind === "reported"
                            ? "neutral"
                            : "warn"
                      }
                      icon={null}
                    >
                      {m.dateKind}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Inspections" padded={false}>
        <ul className="divide-y divide-(--fbg-border-subtle)">
          {view.jobs.map((j) => {
            const lot = LOTS.find((l) => l.id === j.lotId);
            return (
              <li key={j.id} className="flex flex-col gap-2 px-5 py-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-(--fbg-text-primary)">
                    {INSPECTION_TYPE_LABEL[j.type]}
                  </span>
                  <Badge
                    tone={
                      !j.result
                        ? "teal"
                        : j.result.result === "fail"
                          ? "danger"
                          : j.result.result === "pass_with_rework"
                            ? "warn"
                            : "ok"
                    }
                    icon={null}
                  >
                    {!j.result
                      ? `Scheduled ${j.scheduledFor}`
                      : j.result.result === "fail"
                        ? "Did not pass"
                        : j.result.result === "pass_with_rework"
                          ? "Passed with rework"
                          : "Passed"}
                  </Badge>
                </span>
                <span className="text-xs text-(--fbg-text-primary)">
                  {inspectionBadge(j, lot?.lotCode ?? "—")}
                </span>
                {j.result ? (
                  <>
                    <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                      Inspector {j.result.inspectorName} ({j.inspectorOrg}) · report{" "}
                      {j.result.reportDocumentId ?? "—"} in Documents
                    </span>
                    {j.result.findings.length > 0 ? (
                      <ul className="flex flex-col gap-0.5 text-xs text-(--fbg-text-secondary)">
                        {j.result.findings.map((f) => (
                          <li key={f.id}>
                            <Badge
                              tone={
                                f.class === "critical"
                                  ? "danger"
                                  : f.class === "major"
                                    ? "warn"
                                    : "neutral"
                              }
                              icon={null}
                            >
                              {f.class} × {f.count}
                            </Badge>{" "}
                            {f.description}
                            {f.photoDocumentId ? ` · photo ${f.photoDocumentId}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {lot ? (
                      <details className="text-xs text-(--fbg-text-secondary)">
                        <summary className="cursor-pointer text-(--fbg-text-primary)">
                          What this inspection can and cannot tell you
                        </summary>
                        <ul className="mt-1 flex flex-col gap-1">
                          {samplingLimits(j, lot.quantity, qsr.samplingPlan.aqlMajor).map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </>
                ) : (
                  <span className="text-xs text-(--fbg-text-secondary)">
                    {j.inspectorOrg} · checklist v{j.checklistVersion}. You will see the result and
                    the report here.
                  </span>
                )}
              </li>
            );
          })}
          {view.jobs.length === 0 ? (
            <li className="px-5 py-3 text-sm text-(--fbg-text-secondary)">
              No inspection scheduled yet.
            </li>
          ) : null}
        </ul>
      </Panel>

      {openCase ? (
        <Panel
          title="Remediation"
          description="Which remedies apply is set by your contract; no guarantee program is active in the pilot."
        >
          <p className="text-sm text-(--fbg-text-primary)">
            Responsibility is{" "}
            {openCase.responsibility === "undetermined"
              ? "not yet determined"
              : openCase.responsibility.replace(/_/g, " ")}
            ; the case is {openCase.status.replace("_", " ")}.
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
            {openCase.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
