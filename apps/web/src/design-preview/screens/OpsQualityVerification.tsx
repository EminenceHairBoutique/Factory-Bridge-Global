"use client";

/**
 * Internal operations: Quality verification (IA §2.4 `/ops/quality`; QUALITY_ASSURANCE.md §3–§8;
 * SCHEMA_PLAN §2.9). One checkpoint track per project × supplier × variant with the eight-step
 * workflow, the QSR and its sampling plan resolved for the lot, samples and the golden sample
 * agreement, production milestones (estimated vs committed), inspection jobs with the exact badge
 * sentence, findings by class, the shipment-release recommendation, the buyer's decision recorded
 * only against the buyer's message, and the remediation case. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BUYER_DECISION_LABEL,
  INSPECTION_TYPE_LABEL,
  LOTS,
  QUALITY_TODAY,
  QUALITY_TRACKS,
  RESOLUTION_LABEL,
  RESPONSIBILITY_LABEL,
  SAMPLE_KIND_LABEL,
  type BuyerDecision,
  type InspectionJob,
  type RemediationCase,
} from "../demo-data/quality";
import {
  buyerDecisionLabel,
  deriveResult,
  inspectionBadge,
  planText,
  qualitySummary,
  sampleBadge,
  samplingPlanFor,
  sortTracks,
  specBadge,
  trackView,
  validateBuyerDecision,
  validateResult,
  type ResultInput,
  type StepState,
  type TrackView,
} from "../quality-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  Checkbox,
  EmptyState,
  Field,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextInput,
  cx,
  type Tone,
} from "../ui/primitives";

const STEP_TONE: Record<StepState, Tone> = {
  done: "ok",
  current: "teal",
  pending: "neutral",
  blocked: "warn",
  not_needed: "neutral",
};
const STEP_LABEL: Record<StepState, string> = {
  done: "Done",
  current: "Now",
  pending: "Later",
  blocked: "Blocked",
  not_needed: "Not needed",
};
const RESULT_TONE = {
  pass: "ok",
  pass_with_rework: "warn",
  fail: "danger",
  pending: "neutral",
} as const;
const RESULT_LABEL = {
  pass: "Pass",
  pass_with_rework: "Pass with rework",
  fail: "Fail",
  pending: "Pending",
} as const;

const EMPTY_RESULT: ResultInput = {
  critical: "",
  major: "",
  minor: "",
  inspectorName: "",
  reportRef: "",
  reworkFoundUnits: false,
};

export function OpsQualityVerification({
  initialTrackId,
}: {
  initialTrackId?: string | undefined;
}) {
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [decisions, setDecisions] = useState<
    Record<string, { decision: BuyerDecision; ref: string; at: string }>
  >({});
  const [selectedId, setSelectedId] = useState<string>(
    initialTrackId && QUALITY_TRACKS.some((t) => t.id === initialTrackId)
      ? initialTrackId
      : (sortTracks(QUALITY_TRACKS.map((t) => trackView(t, QUALITY_TODAY)))[0]?.track.id ?? ""),
  );
  const [resultInput, setResultInput] = useState<ResultInput>(EMPTY_RESULT);
  const [decision, setDecision] = useState<BuyerDecision | null>(null);
  const [decisionRef, setDecisionRef] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const views = useMemo(
    () => sortTracks(QUALITY_TRACKS.map((t) => trackView(t, QUALITY_TODAY))),
    [],
  );
  const summary = useMemo(() => qualitySummary(views), [views]);
  const view = views.find((v) => v.track.id === selectedId) ?? null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">What a badge may say</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>
          Supplier identity, capability, sample and lot are separate states. One never implies
          another.
        </li>
        <li>
          Every badge resolves to what was checked, by whom, when, against which checklist version,
          and until when.
        </li>
        <li>
          An approved sample proves the supplier can make it. A passed inspection proves a sample of
          a lot met an acceptance rule with a stated statistical risk. Neither is "zero defects".
        </li>
        <li>A lot badge is never shown at supplier level and never carries over to another lot.</li>
        <li>
          A failed inspection blocks the shipment-release recommendation. Factory Bridge records the
          recommendation and the buyer's decision; the decision is the buyer's.
        </li>
      </ul>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Sampling limits</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Acceptance means the sample was within the accept number, not that the lot has at most the
          AQL in defects. Latent defects and units substituted after inspection are outside a
          pre-shipment check. Plan values here are illustrative; verify against the current
          standard.
        </p>
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
    <AppShell workspace="ops" title="Quality verification" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="lock" title="Internal workspace">
          Checkpoints are recorded facts: what was checked, by whom, when, against which checklist
          version. No inspection partner is contracted; inspector names are placeholders. Badges use
          the fixed wording only.
        </Notice>

        <PageHeader
          title="Quality verification"
          lead="One track per project, supplier and variant through spec, sample, golden sample, production, inspection, exceptions, remediation and closure. Release recommendations and badges come from recorded results; decisions after a failure are the buyer's."
          meta={
            <>
              <Badge
                tone={summary.awaitingBuyer > 0 ? "danger" : "ok"}
                icon={summary.awaitingBuyer > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.awaitingBuyer} awaiting buyer decision
              </Badge>
              <Badge tone="teal" icon="clock" className="fbg-num">
                {summary.scheduled} inspection{summary.scheduled === 1 ? "" : "s"} scheduled
              </Badge>
              <Badge tone="warn" icon={null} className="fbg-num">
                {summary.openCases} open case{summary.openCases === 1 ? "" : "s"}
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                {summary.samplesPending} sample{summary.samplesPending === 1 ? "" : "s"} pending
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
            <p className="text-xs font-semibold text-(--fbg-text-primary)">Tracks</p>
            <Panel padded={false}>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {views.map((v) => {
                  const active = v.track.id === selectedId;
                  const current = [...v.steps].reverse().find((s) => s.state === "current");
                  return (
                    <li key={v.track.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(v.track.id);
                          setResultInput(EMPTY_RESULT);
                          setDecision(null);
                          setDecisionRef("");
                        }}
                        aria-pressed={active}
                        className={cx(
                          "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                          active && "bg-(--fbg-selected)",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          {v.releaseRecommendation === "not_recommended" &&
                          !decisions[v.track.id] ? (
                            <Badge tone="danger" icon="alert">
                              Buyer decision pending
                            </Badge>
                          ) : current ? (
                            <Badge tone="teal" icon={null}>
                              {current.label}
                            </Badge>
                          ) : null}
                          {v.jobs.some((j) => j.status === "scheduled") ? (
                            <Badge tone="neutral" icon="clock" className="fbg-num">
                              PSI {v.jobs.find((j) => j.status === "scheduled")?.scheduledFor}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                          {v.track.project.name} · {v.track.supplier.name}
                        </span>
                        <span className="truncate text-[11px] text-(--fbg-text-secondary)">
                          {v.track.variant} · {v.track.assignee ?? "Unassigned"}
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
                extraJobs={jobs.filter((j) => j.trackId === view.track.id)}
                recordedDecision={decisions[view.track.id] ?? null}
                resultInput={resultInput}
                onResultInput={setResultInput}
                onRecordResult={(job, result) => {
                  setJobs((prev) => [...prev, { ...job, status: "done", result }]);
                  setResultInput(EMPTY_RESULT);
                  note(
                    `Recorded ${INSPECTION_TYPE_LABEL[job.type].toLowerCase()} result "${RESULT_LABEL[result.result]}" for ${job.id} from ${result.reportDocumentId}`,
                  );
                }}
                decision={decision}
                onDecision={setDecision}
                decisionRef={decisionRef}
                onDecisionRef={setDecisionRef}
                onRecordDecision={() => {
                  if (!decision) return;
                  const at = `${QUALITY_TODAY} ${new Date().toISOString().slice(11, 16)}`;
                  setDecisions((d) => ({
                    ...d,
                    [view.track.id]: { decision, ref: decisionRef.trim(), at },
                  }));
                  note(
                    `Recorded the buyer's decision "${buyerDecisionLabel(decision)}" for ${view.track.id} (ref ${decisionRef.trim()})`,
                  );
                  setDecision(null);
                  setDecisionRef("");
                }}
              />
            ) : (
              <EmptyState
                title="Select a track"
                body="Buyer decisions pending are listed first."
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
  extraJobs,
  recordedDecision,
  resultInput,
  onResultInput,
  onRecordResult,
  decision,
  onDecision,
  decisionRef,
  onDecisionRef,
  onRecordDecision,
}: {
  view: TrackView;
  extraJobs: InspectionJob[];
  recordedDecision: { decision: BuyerDecision; ref: string; at: string } | null;
  resultInput: ResultInput;
  onResultInput: (v: ResultInput) => void;
  onRecordResult: (job: InspectionJob, result: NonNullable<InspectionJob["result"]>) => void;
  decision: BuyerDecision | null;
  onDecision: (d: BuyerDecision | null) => void;
  decisionRef: string;
  onDecisionRef: (v: string) => void;
  onRecordDecision: () => void;
}) {
  const { track, qsr } = view;
  const jobs = view.jobs.map((j) => extraJobs.find((x) => x.id === j.id) ?? j);
  const scheduled = jobs.find((j) => j.status === "scheduled");
  const lotFor = (j: InspectionJob) => LOTS.find((l) => l.id === j.lotId) ?? null;
  const resolved =
    scheduled && lotFor(scheduled)
      ? samplingPlanFor(lotFor(scheduled)!.quantity, qsr.samplingPlan)
      : null;
  const errors = validateResult(resultInput, resolved);
  const derived =
    resolved && Object.keys(errors).length === 0
      ? deriveResult(
          {
            critical: Number(resultInput.critical),
            major: Number(resultInput.major),
            minor: Number(resultInput.minor),
          },
          resolved,
          resultInput.reworkFoundUnits,
        )
      : null;
  const release = extraJobs.some((j) => j.result?.result === "fail")
    ? "not_recommended"
    : extraJobs.some((j) => j.type === "pre_shipment" && j.result && j.result.result !== "fail")
      ? "recommended"
      : view.releaseRecommendation;
  const decisionError = validateBuyerDecision(decision, decisionRef);
  const openCase = view.cases.find((c) => c.status !== "closed") ?? null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">
            {track.project.name} · {track.supplier.name}
          </h2>
          <p className="text-xs text-(--fbg-text-secondary)">
            {track.variant} · {track.project.buyerOrg} · {track.assignee ?? "Unassigned"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={
              release === "not_recommended"
                ? "danger"
                : release === "recommended"
                  ? "ok"
                  : "neutral"
            }
            icon={
              release === "not_recommended"
                ? "alert"
                : release === "recommended"
                  ? "check"
                  : "clock"
            }
          >
            {release === "not_recommended"
              ? "Shipment release: not recommended"
              : release === "recommended"
                ? "Shipment release: recommended"
                : "Shipment release: not yet assessed"}
          </Badge>
          <Link href={track.supplier.href} className={buttonClasses("ghost", "sm")}>
            Supplier record
          </Link>
          <Link href={track.project.href} className={buttonClasses("ghost", "sm")}>
            Project
          </Link>
        </div>
      </div>

      <Panel title="Checkpoints" description={`Next: ${view.nextAction}`} padded={false}>
        <ol className="grid divide-y divide-(--fbg-border-subtle) md:grid-cols-2 md:divide-y-0 xl:grid-cols-4">
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
              <span className="text-xs text-(--fbg-text-secondary)">{s.summary}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-4 2xl:grid-cols-2">
        <Panel title="Quality specification record" description={specBadge(qsr)}>
          <KeyValue
            columns={1}
            items={[
              { label: "Record", value: `${qsr.id} · v${qsr.version} of ${qsr.specificationId}` },
              { label: "Sampling plan", value: planText(qsr.samplingPlan) },
              { label: "Critical dimensions", value: qsr.criticalDimensions.join("; ") },
              { label: "Tests", value: qsr.tests.join("; ") },
              {
                label: "Defect classes",
                value: (["critical", "major", "minor"] as const)
                  .map((c) => `${c}: ${qsr.defectClasses[c].join(", ")}`)
                  .join(" · "),
              },
            ]}
          />
        </Panel>

        <Panel title="Samples and golden sample" padded={false}>
          <ul className="divide-y divide-(--fbg-border-subtle)">
            {view.samples.map((s) => {
              const badge = sampleBadge(s, track.variant);
              return (
                <li key={s.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-(--fbg-text-primary)">
                      {SAMPLE_KIND_LABEL[s.kind]}
                    </span>
                    <Badge tone={RESULT_TONE[s.result]} icon={null}>
                      {RESULT_LABEL[s.result]}
                    </Badge>
                  </span>
                  <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                    Requested {s.requestedAt} · received {s.receivedAt ?? "—"} · evaluated by{" "}
                    {s.evaluatedBy ?? "—"}
                  </span>
                  <span className="text-xs text-(--fbg-text-secondary)">{s.note}</span>
                  {s.evidenceDocuments.length > 0 ? (
                    <span className="text-xs text-(--fbg-text-secondary)">
                      Evidence: {s.evidenceDocuments.join(", ")}
                    </span>
                  ) : null}
                  {badge ? (
                    <span className="text-xs text-(--fbg-text-primary)">
                      <Icon name="shield" size={12} className="mr-1 inline" />
                      {badge}
                    </span>
                  ) : null}
                </li>
              );
            })}
            {view.samples.length === 0 ? (
              <li className="px-5 py-3 text-sm text-(--fbg-text-secondary)">No samples.</li>
            ) : null}
          </ul>
          {view.golden ? (
            <div className="border-t border-(--fbg-border-subtle) px-5 py-3 text-xs text-(--fbg-text-secondary)">
              Golden sample agreement {view.golden.id}: buyer sign-off {view.golden.buyerSignoffBy}{" "}
              {view.golden.buyerSignoffAt}; supplier acknowledged {view.golden.supplierAckAt ?? "—"}
              ; document {view.golden.documentId}; retained: {view.golden.retainedWhere}.
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Production milestones"
        description="As reported by the supplier. Estimated dates stay estimated until committed."
        padded={false}
      >
        {track.milestones.length === 0 ? (
          <p className="px-5 py-3 text-sm text-(--fbg-text-secondary)">
            Production has not started.
          </p>
        ) : (
          <ul className="grid divide-y divide-(--fbg-border-subtle) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {track.milestones.map((m) => (
              <li key={m.key} className="flex flex-col gap-1 px-5 py-3">
                <span className="text-sm text-(--fbg-text-primary)">{m.label}</span>
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
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Inspections" padded={false}>
        <ul className="divide-y divide-(--fbg-border-subtle)">
          {jobs.map((j) => {
            const lot = lotFor(j);
            const plan = lot ? samplingPlanFor(lot.quantity, qsr.samplingPlan) : null;
            return (
              <li key={j.id} className="flex flex-col gap-2 px-5 py-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-(--fbg-text-primary)">
                    {INSPECTION_TYPE_LABEL[j.type]}
                  </span>
                  <Badge tone={j.result ? RESULT_TONE[j.result.result] : "teal"} icon={null}>
                    {j.result
                      ? RESULT_LABEL[j.result.result]
                      : j.status === "scheduled"
                        ? "Scheduled"
                        : j.status}
                  </Badge>
                  <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                    Lot {lot?.lotCode ?? "—"} ({lot ? lot.quantity.toLocaleString("en-US") : "—"}{" "}
                    pcs) · {j.inspectorOrg} · {j.scheduledFor} · checklist v{j.checklistVersion}
                  </span>
                </span>
                {plan ? (
                  <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                    Plan: code letter {plan.codeLetter}, {plan.sampleSize} units;{" "}
                    {plan.lines
                      .map((l) => `${l.class} AQL ${l.aql} accept ${l.accept} / reject ${l.reject}`)
                      .join(" · ")}{" "}
                    (illustrative)
                  </span>
                ) : null}
                <span className="text-xs text-(--fbg-text-primary)">
                  <Icon name="shield" size={12} className="mr-1 inline" />
                  {inspectionBadge(j, lot?.lotCode ?? "—")}
                </span>
                {j.result ? (
                  <>
                    <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                      Found: {j.result.foundCritical} critical · {j.result.foundMajor} major ·{" "}
                      {j.result.foundMinor} minor · inspector {j.result.inspectorName} · report{" "}
                      {j.result.reportDocumentId ?? "—"}
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
                  </>
                ) : null}
              </li>
            );
          })}
          {jobs.length === 0 ? (
            <li className="px-5 py-3 text-sm text-(--fbg-text-secondary)">
              No inspection scheduled; one is created from the QSR checklist once a lot exists.
            </li>
          ) : null}
        </ul>
      </Panel>

      {scheduled && resolved ? (
        <Panel
          title={`Record the ${INSPECTION_TYPE_LABEL[scheduled.type].toLowerCase()} result for lot ${lotFor(scheduled)?.lotCode}`}
          description={`The result is derived from the accept numbers (${resolved.sampleSize} sampled, code letter ${resolved.codeLetter}); it is not chosen. A report document is required.`}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {(["critical", "major", "minor"] as const).map((c) => (
              <Field
                key={c}
                label={`Found ${c}`}
                required
                htmlFor={`res-${c}`}
                error={errors[c]}
                hint={`accept ${resolved.lines.find((l) => l.class === c)?.accept} / reject ${resolved.lines.find((l) => l.class === c)?.reject}`}
              >
                <TextInput
                  id={`res-${c}`}
                  inputMode="numeric"
                  value={resultInput[c]}
                  onChange={(e) => onResultInput({ ...resultInput, [c]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Inspector" required htmlFor="res-inspector" error={errors.inspectorName}>
              <TextInput
                id="res-inspector"
                value={resultInput.inspectorName}
                onChange={(e) => onResultInput({ ...resultInput, inspectorName: e.target.value })}
              />
            </Field>
            <Field
              label="Report document"
              required
              htmlFor="res-report"
              error={errors.reportRef}
              className="sm:col-span-2"
            >
              <TextInput
                id="res-report"
                value={resultInput.reportRef}
                onChange={(e) => onResultInput({ ...resultInput, reportRef: e.target.value })}
                placeholder="psi-report-L-0007-2026-11-12.pdf"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Checkbox
              id="res-rework"
              label="Found units to be reworked (pass with rework when within the accept numbers)"
              checked={resultInput.reworkFoundUnits}
              onChange={(on) => onResultInput({ ...resultInput, reworkFoundUnits: on })}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              icon="check"
              disabled={!derived}
              onClick={() =>
                derived &&
                onRecordResult(scheduled, {
                  result: derived,
                  sampleSize: resolved.sampleSize,
                  lotSize: lotFor(scheduled)!.quantity,
                  foundCritical: Number(resultInput.critical),
                  foundMajor: Number(resultInput.major),
                  foundMinor: Number(resultInput.minor),
                  reportDocumentId: resultInput.reportRef.trim(),
                  inspectorName: resultInput.inspectorName.trim(),
                  at: QUALITY_TODAY,
                  findings: [],
                })
              }
            >
              Record result
            </Button>
            {derived ? (
              <Badge tone={RESULT_TONE[derived]} icon={null}>
                Derived: {RESULT_LABEL[derived]}
              </Badge>
            ) : (
              <span className="text-xs text-(--fbg-text-secondary)">
                Fill every field to see the derived result.
              </span>
            )}
          </div>
        </Panel>
      ) : null}

      {release === "not_recommended" ? (
        <Panel
          title="Exceptions: the buyer's decision"
          description="Factory Bridge cannot block a shipment; it records the recommendation and the buyer's decision. The decision is the buyer's and is recorded only against the buyer's own message."
        >
          {recordedDecision ? (
            <Notice
              tone="ok"
              icon="check"
              title={`Buyer decided: ${buyerDecisionLabel(recordedDecision.decision)}`}
            >
              Reference {recordedDecision.ref} · recorded {recordedDecision.at}. Remediation
              proceeds per the case below; re-inspection follows any rework.
            </Notice>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Buyer's decision" required htmlFor="dec-choice">
                <Select
                  id="dec-choice"
                  value={decision ?? ""}
                  onChange={(e) => onDecision((e.target.value || null) as BuyerDecision | null)}
                >
                  <option value="">Choose</option>
                  {(Object.keys(BUYER_DECISION_LABEL) as BuyerDecision[]).map((d) => (
                    <option key={d} value={d}>
                      {BUYER_DECISION_LABEL[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Buyer's message reference"
                required
                htmlFor="dec-ref"
                hint="Thread id or approval record; never the operator's own words."
                error={
                  decision && decisionError && decisionError.includes("Reference")
                    ? decisionError
                    : undefined
                }
              >
                <TextInput
                  id="dec-ref"
                  value={decisionRef}
                  onChange={(e) => onDecisionRef(e.target.value)}
                  placeholder="th_tooling · reply 2026-11-06"
                />
              </Field>
              <div className="md:col-span-2">
                <Button
                  variant="primary"
                  icon="check"
                  disabled={decisionError !== null}
                  onClick={onRecordDecision}
                >
                  Record the buyer's decision
                </Button>
              </div>
            </div>
          )}
        </Panel>
      ) : null}

      {openCase ? <CasePanel c={openCase} /> : null}
    </>
  );
}

function CasePanel({ c }: { c: RemediationCase }) {
  return (
    <Panel
      title={`Remediation case ${c.id}`}
      description="Responsibility and resolution use the fixed vocabulary; which remedies Factory Bridge itself offers is OQ-12 and not promised here."
    >
      <KeyValue
        columns={2}
        items={[
          { label: "Source", value: c.source },
          { label: "Status", value: c.status.replace("_", " ") },
          { label: "Responsibility", value: RESPONSIBILITY_LABEL[c.responsibility] },
          {
            label: "Resolution",
            value: c.resolution ? RESOLUTION_LABEL[c.resolution] : "Not agreed",
          },
          { label: "Opened", value: c.openedAt },
          { label: "Closed", value: c.closedAt ?? "—" },
        ]}
      />
      <ul className="mt-3 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
        {c.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Panel>
  );
}
