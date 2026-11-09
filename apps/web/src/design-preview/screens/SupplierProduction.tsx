"use client";

/**
 * 供应商工作台：生产与质检 (IA §2.3 `/supplier/production`, Phase 3; master spec supplier role
 * "report production milestones and submit QA/inspection evidence"; QUALITY_ASSURANCE §3–§5, §7).
 * The supplier's own orders only: production milestones with 已发生 / 预计 / 承诺 dates and evidence,
 * the inspection schedule with readiness conditions (confirm or request a new date), inspection
 * results in the fixed wording with corrective action per finding, and the agreed quality standard
 * and samples in Chinese. Updates go to the platform; the buyer sees them as supplier-reported.
 * Results are never edited here. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  GOLDEN_AGREEMENTS,
  INSPECTION_JOBS,
  LOTS,
  QSRS,
  SAMPLES,
  type DefectFinding,
  type InspectionJob,
  type Milestone,
} from "../demo-data/quality";
import {
  EVIDENCE_SAMPLES,
  FINDING_ZH,
  ORDERS_ZH,
  PAST_ORDERS,
  PRODUCTION_TODAY,
  QSR_ZH,
  RETAINED_ZH,
  SUBMISSIONS,
  SUPPLIER_ID,
  type SupplierSubmission,
} from "../demo-data/supplier-production";
import {
  CORRECTIVE_ZH,
  DATE_KIND_ZH,
  DEFECT_CLASS_ZH,
  INSPECTION_TYPE_ZH,
  MILESTONE_ORDER,
  MILESTONE_ZH,
  applyMilestone,
  canConfirmReadiness,
  checkEvidence,
  commitPackedDate,
  inspectionBadgeZh,
  milestoneFlags,
  milestoneSummaryZh,
  pendingActions,
  planTextZh,
  readiness,
  supplierTracks,
  validateCorrective,
  validateMilestone,
  validateReschedule,
  type CorrectiveAction,
  type CorrectiveInput,
  type DateKind,
  type MilestoneInput,
  type MilestoneKey,
} from "../supplier-production-demo";
import { formatZhDate, formatZhQty } from "../supplier-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  Checkbox,
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
  type Tone,
} from "../ui/primitives";

type Tab = "progress" | "inspection" | "results" | "standard";

const OPT = "（可选）";
const EMPTY_MILESTONE: MilestoneInput = {
  key: "percent_complete",
  kind: "reported",
  date: PRODUCTION_TODAY,
  percent: "",
  reason: "",
  evidence: [],
};
const EMPTY_CORRECTIVE: CorrectiveInput = {
  action: null,
  quantity: "",
  description: "",
  evidence: [],
};
const KIND_TONE: Record<DateKind, Tone> = {
  reported: "neutral",
  estimated: "warn",
  committed: "ok",
};
const SAMPLE_KIND_ZH = { pre_production: "产前样", golden: "封样", counter: "复样" } as const;
const SAMPLE_RESULT_ZH = { pass: "通过", fail: "未通过", pending: "待评估" } as const;

function inspectorZh(org: string): string {
  if (org.startsWith("Third-party")) return "第三方检验机构（未签约，占位）";
  if (org.startsWith("Factory Bridge")) return "平台质检人员（演示）";
  return org;
}

function nowStamp(): string {
  return `${PRODUCTION_TODAY} ${new Date().toISOString().slice(11, 16)}`;
}

export function SupplierProduction({ initialOrderId }: { initialOrderId?: string | undefined }) {
  const tracks = useMemo(() => supplierTracks(SUPPLIER_ID), []);
  const [selected, setSelected] = useState<string>(
    initialOrderId &&
      (tracks.some((t) => t.id === initialOrderId) ||
        PAST_ORDERS.some((p) => p.orderRef === initialOrderId))
      ? initialOrderId
      : (tracks[0]?.id ?? ""),
  );
  const [tab, setTab] = useState<Tab>("progress");
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>(() =>
    Object.fromEntries(tracks.map((t) => [t.id, t.milestones])),
  );
  const [submissions, setSubmissions] = useState<SupplierSubmission[]>(SUBMISSIONS);
  const [readinessConfirmed, setReadinessConfirmed] = useState<Record<string, string>>({});
  const [reschedule, setReschedule] = useState<
    Record<string, { date: string; reason: string; at: string }>
  >({});
  const [corrective, setCorrective] = useState<Record<string, CorrectiveInput & { at: string }>>(
    {},
  );
  const [mInput, setMInput] = useState<MilestoneInput>(EMPTY_MILESTONE);
  const [siteReady, setSiteReady] = useState(false);
  const [rsDate, setRsDate] = useState("");
  const [rsReason, setRsReason] = useState("");
  const [openFinding, setOpenFinding] = useState<string | null>(null);
  const [cInput, setCInput] = useState<CorrectiveInput>(EMPTY_CORRECTIVE);
  const [log, setLog] = useState<string[]>([]);

  const track = tracks.find((t) => t.id === selected) ?? null;
  const past = PAST_ORDERS.find((p) => p.orderRef === selected) ?? null;
  const ms = track ? (milestones[track.id] ?? track.milestones) : [];
  const jobs = track ? INSPECTION_JOBS.filter((j) => j.trackId === track.id) : [];
  const order = track ? ORDERS_ZH.find((o) => o.trackId === track.id) : undefined;
  const pending = (id: string) => {
    const t = tracks.find((x) => x.id === id);
    if (!t) return [];
    const lp =
      [...submissions].reverse().find((s) => s.trackId === id && s.kind === "milestone")?.at ??
      null;
    return pendingActions(
      t,
      milestones[id] ?? t.milestones,
      {
        readinessConfirmed: readinessConfirmed[id] !== undefined,
        rescheduleRequested: reschedule[id] !== undefined,
        correctiveSubmitted: new Set(Object.keys(corrective)),
        lastProgressAt: lp,
      },
      PRODUCTION_TODAY,
    );
  };
  const totalPending = tracks.reduce((n, t) => n + pending(t.id).length, 0);
  const scheduledCount = INSPECTION_JOBS.filter(
    (j) => tracks.some((t) => t.id === j.trackId) && j.status === "scheduled",
  ).length;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);
  const addSubmission = (s: Omit<SupplierSubmission, "id">) =>
    setSubmissions((prev) => [...prev, { ...s, id: `s${prev.length + 1}` }]);

  const mErrors = track ? validateMilestone(mInput, ms, PRODUCTION_TODAY) : [];
  const mFlags = track ? milestoneFlags(mInput, ms) : [];

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">说明</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">进度、检验与整改</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>进度更新提交给平台；买家看到时标注为“供应商报告”。</li>
        <li>
          “已发生”的日期不能晚于今天；“预计”和“承诺”的日期不能早于今天。更改承诺日期需说明原因，买家会看到“交期变更”。
        </li>
        <li>生产进度只增不减；报告包装完成需先报告 100%，并附装箱单或包装照片。</li>
        <li>
          检验结果由检验员记录，您不能修改。主要或严重问题请提交整改说明；如对结果有疑问，请在消息中联系平台。
        </li>
        <li>检验结论只针对该批次的抽样，不代表其他批次或您的工厂整体。</li>
        <li>上传的文件在平台核对前标注为“供应商提供，未核验”。</li>
      </ul>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">本次操作记录</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">暂无。</p>
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
    <AppShell workspace="supplier" title="生产与质检" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="生产与质检"
          lead="报告生产进度、确认检验安排、查看检验结果并提交整改说明。所有内容经平台转达买家。"
          meta={
            <>
              <Badge
                tone={totalPending > 0 ? "warn" : "ok"}
                icon={totalPending > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                待处理 {totalPending}
              </Badge>
              <Badge tone="teal" icon="clock" className="fbg-num">
                检验已安排 {scheduledCount}
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                截至 {formatZhDate(PRODUCTION_TODAY)}
              </Badge>
            </>
          }
          actions={
            <Link href="/design-preview/supplier/messages" className={buttonClasses("secondary")}>
              消息
            </Link>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold text-(--fbg-text-primary)">订单</p>
            <Panel padded={false}>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {tracks.map((t) => {
                  const o = ORDERS_ZH.find((x) => x.trackId === t.id);
                  const n = pending(t.id).length;
                  const lot = LOTS.find((l) => l.trackId === t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-pressed={selected === t.id}
                        onClick={() => setSelected(t.id)}
                        className={cx(
                          "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                          selected === t.id && "bg-(--fbg-selected)",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={n > 0 ? "warn" : "teal"} icon={null} className="fbg-num">
                            {n > 0 ? `待处理 ${n}` : "生产中"}
                          </Badge>
                        </span>
                        <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                          {o?.productZh ?? t.variant}
                        </span>
                        <span className="fbg-num truncate text-[11px] text-(--fbg-text-secondary)">
                          {o?.orderRef} · 批次 {lot?.lotCode ?? "—"} ·{" "}
                          {o ? `${formatZhQty(o.quantity)} ${o.unit}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {PAST_ORDERS.map((p) => (
                  <li key={p.orderRef}>
                    <button
                      type="button"
                      aria-pressed={selected === p.orderRef}
                      onClick={() => setSelected(p.orderRef)}
                      className={cx(
                        "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                        selected === p.orderRef && "bg-(--fbg-selected)",
                      )}
                    >
                      <span>
                        <Badge tone="neutral" icon="check">
                          已出货
                        </Badge>
                      </span>
                      <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                        {p.productZh}
                      </span>
                      <span className="fbg-num truncate text-[11px] text-(--fbg-text-secondary)">
                        {p.orderRef} · 批次 {p.lotCode} · {formatZhDate(p.shippedAt)} 出货
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {past ? (
              <Panel
                title={past.productZh}
                description={`${past.orderRef} · 批次 ${past.lotCode} · ${past.buyerLabel}`}
              >
                <ul className="flex flex-col gap-2 text-sm text-(--fbg-text-primary)">
                  <li className="fbg-num">
                    数量：{formatZhQty(past.quantity)} 件 · 出货日期：{formatZhDate(past.shippedAt)}
                  </li>
                  <li>
                    <Icon name="shield" size={12} className="mr-1 inline" />
                    {past.inspection}
                  </li>
                  <li>整改：{past.corrective}</li>
                </ul>
              </Panel>
            ) : track && order ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">
                      {order.productZh}
                    </h2>
                    <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                      {order.orderRef} · 批次{" "}
                      {LOTS.find((l) => l.trackId === track.id)?.lotCode ?? "—"} ·{" "}
                      {formatZhQty(order.quantity)} {order.unit} · {order.buyerLabel} ·{" "}
                      {order.specVersion}
                    </p>
                  </div>
                </div>

                {pending(track.id).length > 0 ? (
                  <Notice tone="warn" icon="alert" title="待您处理">
                    <ul className="mt-1 flex flex-col gap-1">
                      {pending(track.id).map((a) => (
                        <li key={a.key} className="flex flex-wrap items-center gap-2">
                          <span>{a.text}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setTab(
                                a.key === "readiness"
                                  ? "inspection"
                                  : a.key === "corrective"
                                    ? "results"
                                    : "progress",
                              )
                            }
                          >
                            前往
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Notice>
                ) : (
                  <Notice tone="ok" icon="check" title="暂无待处理事项">
                    进度、检验安排和整改说明均已提交，等待平台核对。
                  </Notice>
                )}

                <SegmentedControl
                  label="内容"
                  size="sm"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "progress", label: "生产进度" },
                    { value: "inspection", label: "检验安排" },
                    { value: "results", label: "检验结果与整改" },
                    { value: "standard", label: "质检标准与样品" },
                  ]}
                />

                {tab === "progress" ? (
                  <>
                    <Panel
                      title="生产节点"
                      description="日期类型：已发生（实际）、预计（可能变化）、承诺（您确认的日期）。"
                      padded={false}
                    >
                      <ul className="grid divide-y divide-(--fbg-border-subtle) sm:grid-cols-2 sm:divide-y-0 2xl:grid-cols-4">
                        {MILESTONE_ORDER.map((k) => {
                          const m = ms.find((x) => x.key === k);
                          return (
                            <li key={k} className="flex flex-col gap-1 px-5 py-3">
                              <span className="text-sm text-(--fbg-text-primary)">
                                {MILESTONE_ZH[k]}
                              </span>
                              <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                                {m?.value
                                  ? `${m.value.replace(" (supplier-reported)", "（供应商报告）")} · `
                                  : ""}
                                {m?.date ? formatZhDate(m.date) : "未报告"}
                              </span>
                              {m ? (
                                <span>
                                  <Badge tone={KIND_TONE[m.dateKind]} icon={null}>
                                    {DATE_KIND_ZH[m.dateKind]}
                                  </Badge>
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </Panel>

                    <Panel title="更新进度" description="提交给平台核对后转达买家。">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="节点" htmlFor="ms-key" optionalText={OPT}>
                          <Select
                            id="ms-key"
                            value={mInput.key}
                            onChange={(e) =>
                              setMInput({
                                ...mInput,
                                key: e.target.value as MilestoneKey,
                                kind:
                                  e.target.value === "percent_complete" ? "reported" : mInput.kind,
                              })
                            }
                          >
                            {MILESTONE_ORDER.map((k) => (
                              <option key={k} value={k}>
                                {MILESTONE_ZH[k]}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="日期类型" htmlFor="ms-kind" optionalText={OPT}>
                          <Select
                            id="ms-kind"
                            value={mInput.kind}
                            onChange={(e) =>
                              setMInput({ ...mInput, kind: e.target.value as DateKind })
                            }
                          >
                            {(["reported", "estimated", "committed"] as DateKind[]).map((k) => (
                              <option key={k} value={k}>
                                {DATE_KIND_ZH[k]}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="日期" required htmlFor="ms-date" optionalText={OPT}>
                          <TextInput
                            id="ms-date"
                            type="date"
                            value={mInput.date}
                            onChange={(e) => setMInput({ ...mInput, date: e.target.value })}
                          />
                        </Field>
                        {mInput.key === "percent_complete" ? (
                          <Field label="生产进度（%）" required htmlFor="ms-pct" optionalText={OPT}>
                            <TextInput
                              id="ms-pct"
                              inputMode="numeric"
                              value={mInput.percent}
                              onChange={(e) => setMInput({ ...mInput, percent: e.target.value })}
                              placeholder="例如 85"
                            />
                          </Field>
                        ) : (
                          <Field
                            label="原因"
                            htmlFor="ms-reason"
                            optionalText={OPT}
                            hint="更改承诺日期时必填。"
                          >
                            <TextInput
                              id="ms-reason"
                              value={mInput.reason}
                              onChange={(e) => setMInput({ ...mInput, reason: e.target.value })}
                            />
                          </Field>
                        )}
                        <div className="md:col-span-2">
                          <EvidencePicker
                            idPrefix="ms-ev"
                            value={mInput.evidence}
                            onChange={(evidence) => setMInput({ ...mInput, evidence })}
                          />
                        </div>
                      </div>
                      {mFlags.length > 0 ? (
                        <p className="mt-3 text-xs text-(--fbg-status-warn)">
                          买家将看到：{mFlags.join("、")}
                        </p>
                      ) : null}
                      {mErrors.length > 0 ? (
                        <ul className="mt-2 text-xs text-(--fbg-status-danger)">
                          {mErrors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-4">
                        <Button
                          variant="primary"
                          icon="check"
                          disabled={mErrors.length > 0}
                          onClick={() => {
                            setMilestones((prev) => ({
                              ...prev,
                              [track.id]: applyMilestone(ms, mInput),
                            }));
                            addSubmission({
                              trackId: track.id,
                              at: nowStamp(),
                              kind: "milestone",
                              summary: milestoneSummaryZh(mInput),
                              evidence: mInput.evidence,
                              state: "待平台核对",
                              flags: mFlags,
                            });
                            note(`已提交：${milestoneSummaryZh(mInput)}`);
                            setMInput(EMPTY_MILESTONE);
                          }}
                        >
                          提交进度
                        </Button>
                      </div>
                    </Panel>

                    <SubmissionList items={submissions.filter((s) => s.trackId === track.id)} />
                  </>
                ) : null}

                {tab === "inspection" ? (
                  <InspectionTab
                    jobs={jobs}
                    milestones={ms}
                    confirmedAt={readinessConfirmed[track.id] ?? null}
                    rescheduled={reschedule[track.id] ?? null}
                    siteReady={siteReady}
                    onSiteReady={setSiteReady}
                    rsDate={rsDate}
                    rsReason={rsReason}
                    onRsDate={setRsDate}
                    onRsReason={setRsReason}
                    onConfirm={(job) => {
                      const at = nowStamp();
                      setReadinessConfirmed((r) => ({ ...r, [track.id]: at }));
                      setMilestones((prev) => ({ ...prev, [track.id]: commitPackedDate(ms) }));
                      addSubmission({
                        trackId: track.id,
                        at,
                        kind: "readiness",
                        summary: `确认按期接受${INSPECTION_TYPE_ZH[job.type]}（${formatZhDate(job.scheduledFor)}）；包装完成日期记为承诺`,
                        evidence: [],
                        state: "待平台核对",
                        flags: [],
                      });
                      note(`已确认${INSPECTION_TYPE_ZH[job.type]}安排`);
                    }}
                    onReschedule={(job) => {
                      const at = nowStamp();
                      setReschedule((r) => ({
                        ...r,
                        [track.id]: { date: rsDate, reason: rsReason.trim(), at },
                      }));
                      addSubmission({
                        trackId: track.id,
                        at,
                        kind: "reschedule",
                        summary: `申请将${INSPECTION_TYPE_ZH[job.type]}改至 ${formatZhDate(rsDate)}：${rsReason.trim()}`,
                        evidence: [],
                        state: "待平台核对",
                        flags: ["检验改期申请"],
                      });
                      note(`已申请改期至 ${formatZhDate(rsDate)}`);
                      setRsDate("");
                      setRsReason("");
                    }}
                  />
                ) : null}

                {tab === "results" ? (
                  <ResultsTab
                    jobs={jobs}
                    submitted={corrective}
                    openFinding={openFinding}
                    onOpen={(id) => {
                      setOpenFinding(id);
                      setCInput(EMPTY_CORRECTIVE);
                    }}
                    input={cInput}
                    onInput={setCInput}
                    onSubmit={(f) => {
                      const at = nowStamp();
                      setCorrective((c) => ({ ...c, [f.id]: { ...cInput, at } }));
                      addSubmission({
                        trackId: track.id,
                        at,
                        kind: "corrective",
                        summary: `整改说明（${DEFECT_CLASS_ZH[f.class]}：${FINDING_ZH[f.id] ?? f.description}）：${cInput.action ? CORRECTIVE_ZH[cInput.action] : ""}，${cInput.quantity} 件`,
                        evidence: cInput.evidence,
                        state: "待平台核对",
                        flags: [],
                      });
                      note(`已提交整改说明（${f.id}）`);
                      setOpenFinding(null);
                    }}
                  />
                ) : null}

                {tab === "standard" ? (
                  <StandardTab trackId={track.id} qsrId={track.qsrId} lotSize={order.quantity} />
                ) : null}
              </>
            ) : (
              <EmptyState title="请选择订单" body="进行中的订单排在前面。" icon="document" />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function EvidencePicker({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [rejected, setRejected] = useState<Array<{ name: string; reason: string }>>([]);
  const add = (files: Array<{ name: string; type: string; size: number }>) => {
    const r = checkEvidence(files);
    onChange([...value, ...r.accepted.filter((n) => !value.includes(n))]);
    setRejected(r.rejected);
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-(--fbg-text-primary)">证据文件{OPT}</p>
      <div className="flex flex-wrap gap-2">
        {EVIDENCE_SAMPLES.map((s) => (
          <Button
            key={s.name}
            size="sm"
            variant="ghost"
            icon="upload"
            onClick={() => add([{ name: s.name, type: s.type, size: s.size }])}
          >
            {s.label}
          </Button>
        ))}
        <label htmlFor={`${idPrefix}-file`} className={buttonClasses("secondary", "sm")}>
          选择文件
        </label>
        <input
          id={`${idPrefix}-file`}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            add(
              Array.from(e.target.files ?? []).map((f) => ({
                name: f.name,
                type: f.type,
                size: f.size,
              })),
            );
            e.target.value = "";
          }}
        />
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((n) => (
            <li key={n}>
              <Badge tone="neutral" icon="document">
                {n} · 供应商提供，未核验
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {rejected.length > 0 ? (
        <ul className="text-xs text-(--fbg-status-danger)">
          {rejected.map((r) => (
            <li key={r.name}>
              {r.name}：{r.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmissionList({ items }: { items: SupplierSubmission[] }) {
  return (
    <Panel
      title="提交记录"
      description="平台核对后转达买家，买家看到时标注为“供应商报告”。"
      padded={false}
    >
      <ol className="divide-y divide-(--fbg-border-subtle)">
        {[...items].reverse().map((s) => (
          <li key={s.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={s.state === "已转达买家" ? "ok" : "teal"} icon={null}>
                {s.state}
              </Badge>
              {s.flags.map((f) => (
                <Badge key={f} tone="warn" icon="alert">
                  {f}
                </Badge>
              ))}
              <span className="fbg-num text-xs text-(--fbg-text-secondary)">{s.at}</span>
            </span>
            <span className="text-(--fbg-text-primary)">{s.summary}</span>
            {s.evidence.length > 0 ? (
              <span className="text-xs text-(--fbg-text-secondary)">
                证据：{s.evidence.join("、")}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function InspectionTab({
  jobs,
  milestones,
  confirmedAt,
  rescheduled,
  siteReady,
  onSiteReady,
  rsDate,
  rsReason,
  onRsDate,
  onRsReason,
  onConfirm,
  onReschedule,
}: {
  jobs: InspectionJob[];
  milestones: Milestone[];
  confirmedAt: string | null;
  rescheduled: { date: string; reason: string; at: string } | null;
  siteReady: boolean;
  onSiteReady: (v: boolean) => void;
  rsDate: string;
  rsReason: string;
  onRsDate: (v: string) => void;
  onRsReason: (v: string) => void;
  onConfirm: (job: InspectionJob) => void;
  onReschedule: (job: InspectionJob) => void;
}) {
  const job = jobs.find((j) => j.status === "scheduled");
  if (!job)
    return (
      <EmptyState title="暂无待安排的检验" body="平台安排检验后会在这里通知您。" icon="clock" />
    );
  const lot = LOTS.find((l) => l.id === job.lotId);
  const items = readiness(job, milestones);
  const confirmErrors = canConfirmReadiness(job, milestones, siteReady);
  const rsErrors = validateReschedule(job, rsDate, rsReason, PRODUCTION_TODAY);
  return (
    <>
      <Panel
        title={`${INSPECTION_TYPE_ZH[job.type]}：${formatZhDate(job.scheduledFor)}`}
        description="检验由平台安排；您确认现场准备或申请改期。"
      >
        <ul className="flex flex-col gap-1 text-sm text-(--fbg-text-primary)">
          <li className="fbg-num">
            批次 {lot?.lotCode ?? "—"} · {lot ? formatZhQty(lot.quantity) : "—"} 件 · 检验清单 v
            {job.checklistVersion}
          </li>
          <li>检验方：{inspectorZh(job.inspectorOrg)}</li>
          <li className="text-xs text-(--fbg-text-secondary)">
            抽样方案：{lot ? planTextZh(lot.quantity) : "—"}
          </li>
        </ul>
        <p className="mt-4 text-xs font-semibold text-(--fbg-text-primary)">检验条件（试点方案）</p>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {items.map((i) => (
            <li key={i.label} className="flex flex-wrap items-center gap-2">
              <Badge tone={i.met ? "ok" : "warn"} icon={i.met ? "check" : "clock"}>
                {i.met ? "已满足" : "未满足"}
              </Badge>
              <span className="text-(--fbg-text-primary)">{i.label}</span>
              <span className="fbg-num text-xs text-(--fbg-text-secondary)">{i.detail}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {confirmedAt ? (
        <Notice tone="ok" icon="check" title={`已确认按期检验（${confirmedAt}）`}>
          包装完成日期已记为承诺日期。检验员到场前，请按 QSR v3 准备生产留样。
        </Notice>
      ) : rescheduled ? (
        <Notice
          tone="teal"
          icon="clock"
          title={`改期申请待平台确认：${formatZhDate(rescheduled.date)}`}
        >
          原因：{rescheduled.reason}。平台确认前，检验日期仍为 {formatZhDate(job.scheduledFor)}。
        </Notice>
      ) : (
        <div className="grid gap-4 2xl:grid-cols-2">
          <Panel title="确认按期检验">
            <Checkbox
              id="insp-site"
              label="检验当日现场可提供 QSR v3 与生产留样"
              checked={siteReady}
              onChange={onSiteReady}
            />
            <p className="mt-2 text-xs text-(--fbg-text-secondary)">
              确认后，包装完成日期将从“预计”记为“承诺”。生产进度未到 100% 时可先确认，检验前须完成。
            </p>
            {confirmErrors.length > 0 ? (
              <ul className="mt-2 text-xs text-(--fbg-status-danger)">
                {confirmErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              <Button
                variant="primary"
                icon="check"
                disabled={confirmErrors.length > 0}
                onClick={() => onConfirm(job)}
              >
                确认按期检验
              </Button>
            </div>
          </Panel>
          <Panel title="申请改期">
            <div className="grid gap-3">
              <Field label="建议日期" required htmlFor="rs-date" optionalText={OPT}>
                <TextInput
                  id="rs-date"
                  type="date"
                  value={rsDate}
                  onChange={(e) => onRsDate(e.target.value)}
                />
              </Field>
              <Field label="原因" required htmlFor="rs-reason" optionalText={OPT}>
                <TextInput
                  id="rs-reason"
                  value={rsReason}
                  onChange={(e) => onRsReason(e.target.value)}
                />
              </Field>
            </div>
            {(rsDate || rsReason) && rsErrors.length > 0 ? (
              <ul className="mt-2 text-xs text-(--fbg-status-danger)">
                {rsErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              <Button
                variant="secondary"
                disabled={rsErrors.length > 0}
                onClick={() => onReschedule(job)}
              >
                提交改期申请
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

function ResultsTab({
  jobs,
  submitted,
  openFinding,
  onOpen,
  input,
  onInput,
  onSubmit,
}: {
  jobs: InspectionJob[];
  submitted: Record<string, CorrectiveInput & { at: string }>;
  openFinding: string | null;
  onOpen: (id: string | null) => void;
  input: CorrectiveInput;
  onInput: (v: CorrectiveInput) => void;
  onSubmit: (f: DefectFinding) => void;
}) {
  const done = jobs.filter((j) => j.result);
  if (done.length === 0)
    return (
      <EmptyState
        title="暂无检验结果"
        body="检验完成后，结果与发现项会显示在这里。"
        icon="shield"
      />
    );
  return (
    <>
      <Notice tone="neutral" icon="info" title="检验结果不可修改">
        结果由检验员记录。主要或严重问题请提交整改说明；如对结果有疑问，请
        <Link href="/design-preview/supplier/messages" className="underline">
          在消息中联系平台
        </Link>
        。
      </Notice>
      {done.map((j) => {
        const lot = LOTS.find((l) => l.id === j.lotId);
        const r = j.result!;
        return (
          <Panel key={j.id} title={INSPECTION_TYPE_ZH[j.type]} padded={false}>
            <div className="flex flex-col gap-1 px-5 py-3 text-sm">
              <span className="text-(--fbg-text-primary)">
                <Icon name="shield" size={12} className="mr-1 inline" />
                {inspectionBadgeZh(j, lot?.lotCode ?? "—")}
              </span>
              <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                检验方：{inspectorZh(j.inspectorOrg)} · 报告 {r.reportDocumentId ?? "—"} · 严重{" "}
                {r.foundCritical} · 主要 {r.foundMajor} · 次要 {r.foundMinor}
              </span>
            </div>
            <ul className="divide-y divide-(--fbg-border-subtle) border-t border-(--fbg-border-subtle)">
              {r.findings.map((f) => {
                const sub = submitted[f.id];
                const needs = f.class !== "minor";
                const errors = validateCorrective(f, input);
                return (
                  <li key={f.id} className="flex flex-col gap-2 px-5 py-3 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
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
                        {DEFECT_CLASS_ZH[f.class]} × {f.count}
                      </Badge>
                      <span className="text-(--fbg-text-primary)">
                        {FINDING_ZH[f.id] ?? f.description}
                      </span>
                      {f.photoDocumentId ? (
                        <span className="text-xs text-(--fbg-text-secondary)">
                          照片 {f.photoDocumentId}
                        </span>
                      ) : null}
                    </span>
                    {sub ? (
                      <span className="text-xs text-(--fbg-text-secondary)">
                        <Badge tone="teal" icon={null}>
                          整改说明待平台审核
                        </Badge>{" "}
                        {sub.action ? CORRECTIVE_ZH[sub.action] : ""}，{sub.quantity} 件：
                        {sub.description}
                        {sub.evidence.length > 0 ? `（证据：${sub.evidence.join("、")}）` : ""}
                      </span>
                    ) : !needs ? (
                      <span className="text-xs text-(--fbg-text-secondary)">
                        次要问题无需提交整改说明。
                      </span>
                    ) : openFinding === f.id ? (
                      <div className="flex flex-col gap-3 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field
                            label="整改方式"
                            required
                            htmlFor={`ca-action-${f.id}`}
                            optionalText={OPT}
                          >
                            <Select
                              id={`ca-action-${f.id}`}
                              value={input.action ?? ""}
                              onChange={(e) =>
                                onInput({
                                  ...input,
                                  action: (e.target.value || null) as CorrectiveAction | null,
                                })
                              }
                            >
                              <option value="">请选择</option>
                              {(Object.keys(CORRECTIVE_ZH) as CorrectiveAction[]).map((a) => (
                                <option key={a} value={a}>
                                  {CORRECTIVE_ZH[a]}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field
                            label="涉及数量（卷/件）"
                            required
                            htmlFor={`ca-qty-${f.id}`}
                            optionalText={OPT}
                          >
                            <TextInput
                              id={`ca-qty-${f.id}`}
                              inputMode="numeric"
                              value={input.quantity}
                              onChange={(e) => onInput({ ...input, quantity: e.target.value })}
                            />
                          </Field>
                          <Field
                            label="原因与整改措施"
                            required
                            htmlFor={`ca-desc-${f.id}`}
                            optionalText={OPT}
                            className="md:col-span-2"
                          >
                            <TextArea
                              id={`ca-desc-${f.id}`}
                              rows={3}
                              value={input.description}
                              onChange={(e) => onInput({ ...input, description: e.target.value })}
                            />
                          </Field>
                          <div className="md:col-span-2">
                            <EvidencePicker
                              idPrefix={`ca-ev-${f.id}`}
                              value={input.evidence}
                              onChange={(evidence) => onInput({ ...input, evidence })}
                            />
                          </div>
                        </div>
                        {errors.length > 0 && (input.action || input.description) ? (
                          <ul className="text-xs text-(--fbg-status-danger)">
                            {errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            icon="check"
                            disabled={errors.length > 0}
                            onClick={() => onSubmit(f)}
                          >
                            提交整改说明
                          </Button>
                          <Button variant="ghost" onClick={() => onOpen(null)}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Button size="sm" variant="secondary" onClick={() => onOpen(f.id)}>
                          填写整改说明
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        );
      })}
    </>
  );
}

function StandardTab({
  trackId,
  qsrId,
  lotSize,
}: {
  trackId: string;
  qsrId: string;
  lotSize: number;
}) {
  const qsr = QSRS.find((q) => q.id === qsrId)!;
  const zh = QSR_ZH[qsrId];
  const samples = SAMPLES.filter((s) => s.trackId === trackId);
  const golden = GOLDEN_AGREEMENTS.find((g) => samples.some((s) => s.id === g.sampleId));
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <Panel
        title={`质检标准 v${qsr.version}`}
        description={`买家确认于 ${formatZhDate(qsr.approvedByBuyerAt)}。${zh ? `译文由${zh.checkedBy}核对（${formatZhDate(zh.checkedAt)}）；以英文版为准。` : ""}如需修改，请在消息中联系平台。`}
      >
        {zh ? (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-(--fbg-text-primary)">关键尺寸与材料</p>
              <ul className="mt-1 list-disc pl-5 text-(--fbg-text-primary)">
                {zh.critical.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-(--fbg-text-primary)">测试</p>
              <ul className="mt-1 list-disc pl-5 text-(--fbg-text-primary)">
                {zh.tests.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-(--fbg-text-primary)">缺陷分类</p>
              <ul className="mt-1 text-(--fbg-text-primary)">
                {(["critical", "major", "minor"] as const).map((c) => (
                  <li key={c}>
                    {DEFECT_CLASS_ZH[c]}：{zh.defects[c].join("、")}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-(--fbg-text-secondary)">抽样方案：{planTextZh(lotSize)}</p>
          </div>
        ) : (
          <p className="text-sm text-(--fbg-text-secondary)">中文译文待平台核对。</p>
        )}
      </Panel>
      <Panel title="样品与封样" padded={false}>
        <ul className="divide-y divide-(--fbg-border-subtle)">
          {samples.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
              <span className="text-(--fbg-text-primary)">{SAMPLE_KIND_ZH[s.kind]}</span>
              <Badge
                tone={s.result === "pass" ? "ok" : s.result === "fail" ? "danger" : "neutral"}
                icon={null}
              >
                {SAMPLE_RESULT_ZH[s.result]}
              </Badge>
              <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                收到 {formatZhDate(s.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
        {golden ? (
          <p className="border-t border-(--fbg-border-subtle) px-5 py-3 text-xs text-(--fbg-text-secondary)">
            封样协议：买家于 {formatZhDate(golden.buyerSignoffAt)} 签署，您于{" "}
            {formatZhDate(golden.supplierAckAt)} 确认；封样留存：
            {RETAINED_ZH[golden.id] ?? golden.retainedWhere}。
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
