"use client";

/**
 * 询价单 inbox + 提交报价 (IA §2.3 `/supplier/rfqs`, `/supplier/rfqs/[id]`). Simplified-Chinese first.
 * Local state only. Replies and quotes go to the platform for review; nothing is sent to a buyer directly.
 */
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  INCOTERM_GLOSS,
  SUPPLIER_PRODUCTS,
  SUPPLIER_RFQS,
  type IncotermCode,
  type RfqStatus,
  type SupplierRfq,
  type SupplierTier,
} from "../demo-data/supplier";
import { daysUntil, formatZhDate, quoteSubmissionGate, validateBasis } from "../supplier-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Checkbox,
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
import { TierTable } from "../ui/TierTable";

const TODAY = "2026-11-07";

const STATUS_TONE: Record<RfqStatus, Tone> = {
  待回复: "warn",
  需要澄清: "warn",
  已报价: "teal",
  已拒绝: "neutral",
};

type Filter = "全部" | RfqStatus;
const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "全部", label: "全部" },
  { value: "待回复", label: "待回复" },
  { value: "需要澄清", label: "需要澄清" },
  { value: "已报价", label: "已报价" },
  { value: "已拒绝", label: "已拒绝" },
];

type Mode = "view" | "quote" | "clarify" | "decline";

interface QuoteDraft {
  currency: "CNY" | "USD";
  unit: string;
  basisCode: IncotermCode;
  basisPlace: string;
  tiers: SupplierTier[];
  toolingAmount: string;
  toolingIncluded: boolean;
  leadTimeDays: string;
  paymentTerms: string;
  validUntil: string;
  specConfirmed: boolean;
  notes: string;
}

function prefillFor(rfq: SupplierRfq): QuoteDraft {
  const match = SUPPLIER_PRODUCTS.find((p) =>
    rfq.productZh.startsWith(p.nameZh.split(" ")[0] ?? "—"),
  );
  return {
    currency: match?.currency ?? "CNY",
    unit: rfq.unit,
    basisCode: match?.basis.code ?? "FOB",
    basisPlace: match?.basis.place ?? "",
    tiers: match
      ? match.tiers.map((t) => ({ ...t }))
      : [{ id: 1, minQty: rfq.quantity, maxQty: null, unitPrice: null }],
    toolingAmount: match?.toolingFee ? String(match.toolingFee.amount) : "",
    toolingIncluded: match?.toolingFee?.included ?? false,
    leadTimeDays:
      match?.leadTimeDays !== null && match?.leadTimeDays !== undefined
        ? String(match.leadTimeDays)
        : "",
    paymentTerms: "30% 定金，发货前付清余款",
    validUntil: "",
    specConfirmed: false,
    notes: "",
  };
}

export function SupplierRfqs() {
  return (
    <Suspense fallback={null}>
      <SupplierRfqsInner />
    </Suspense>
  );
}

function SupplierRfqsInner() {
  const params = useSearchParams();
  const initialId = params?.get("rfq") ?? SUPPLIER_RFQS[0]?.id ?? "";
  const [rfqs, setRfqs] = useState<SupplierRfq[]>(SUPPLIER_RFQS);
  const [selectedId, setSelectedId] = useState(initialId);
  const [filter, setFilter] = useState<Filter>("全部");
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [clarifyReply, setClarifyReply] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [listOpen, setListOpen] = useState(false);

  const rfq = rfqs.find((r) => r.id === selectedId) ?? rfqs[0];
  const visible = rfqs.filter((r) => filter === "全部" || r.status === filter);

  const gate = useMemo(() => (draft ? quoteSubmissionGate(draft) : []), [draft]);
  const basisIssue = draft ? validateBasis(draft.basisCode, draft.basisPlace) : null;

  const select = (id: string) => {
    setSelectedId(id);
    setMode("view");
    setDraft(null);
    setClarifyReply("");
    setDeclineReason("");
    setListOpen(false);
  };

  const patchRfq = (id: string, patch: Partial<SupplierRfq>) =>
    setRfqs((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  if (!rfq) return null;
  const left = daysUntil(rfq.replyBy, TODAY) ?? 0;

  return (
    <AppShell workspace="supplier" title="询价单">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="询价单"
          lead="买家经平台审核后发出的询价。您看到的是买家确认过的规格版本；您的回复与报价同样经平台审核后转达。"
          meta={
            <Badge tone="neutral" icon="info">
              买家身份在授权披露前以“平台买家”显示
            </Badge>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
          {/* 列表 */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <button
              type="button"
              className="mb-2 flex w-full items-center justify-between rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) px-4 py-3 text-left text-sm lg:hidden"
              onClick={() => setListOpen((v) => !v)}
              aria-expanded={listOpen}
            >
              <span className="truncate">
                {rfq.ref} · {rfq.productZh}
              </span>
              <Icon
                name="chevron-down"
                size={16}
                className={cx("shrink-0", listOpen && "rotate-180")}
              />
            </button>
            <Panel padded={false} className={cx(!listOpen && "hidden lg:block")}>
              <div className="border-b border-(--fbg-border-subtle) p-3">
                <SegmentedControl
                  label="筛选"
                  size="sm"
                  options={FILTERS}
                  value={filter}
                  onChange={setFilter}
                />
              </div>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {visible.map((r) => {
                  const active = r.id === rfq.id;
                  const d = daysUntil(r.replyBy, TODAY) ?? 0;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => select(r.id)}
                        aria-pressed={active}
                        className={cx(
                          "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-(--fbg-hover)",
                          active && "bg-(--fbg-selected)",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                            {r.ref}
                          </span>
                          <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                        </span>
                        <span className="text-sm font-medium text-(--fbg-text-primary)">
                          {r.productZh}
                        </span>
                        <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                          {new Intl.NumberFormat("zh-CN").format(r.quantity)} {r.unit} ·{" "}
                          {r.buyerLabel}
                        </span>
                        {r.status === "待回复" || r.status === "需要澄清" ? (
                          <span
                            className={cx(
                              "fbg-num text-xs",
                              d <= 3 ? "text-(--fbg-status-danger)" : "text-(--fbg-text-secondary)",
                            )}
                          >
                            回复截止 {formatZhDate(r.replyBy)}（剩余 {d} 天）
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
                {visible.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-(--fbg-text-secondary)">
                    该状态下暂无询价单。
                  </li>
                ) : null}
              </ul>
            </Panel>
          </div>

          {/* 详情 */}
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {rfq.productZh}
                  <Badge tone={STATUS_TONE[rfq.status]}>{rfq.status}</Badge>
                </span>
              }
              description={`${rfq.productEn} · ${rfq.ref}`}
            >
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["买家", rfq.buyerLabel],
                  [
                    "采购数量",
                    `${new Intl.NumberFormat("zh-CN").format(rfq.quantity)} ${rfq.unit}`,
                  ],
                  ["目的地", rfq.destination],
                  ["买家期望条款", rfq.targetBasis],
                  ["收到日期", formatZhDate(rfq.receivedAt)],
                  [
                    "回复截止",
                    rfq.status === "待回复" || rfq.status === "需要澄清"
                      ? `${formatZhDate(rfq.replyBy)}（剩余 ${left} 天）`
                      : formatZhDate(rfq.replyBy),
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-(--fbg-text-secondary)">{k}</dt>
                    <dd className="fbg-num mt-0.5 text-sm text-(--fbg-text-primary)">{v}</dd>
                  </div>
                ))}
              </dl>
              {rfq.attachments.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {rfq.attachments.map((a) => (
                    <li
                      key={a.name}
                      className="flex items-center gap-2 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) px-3 py-2 text-sm"
                    >
                      <Icon name="document" size={14} className="text-(--fbg-text-secondary)" />
                      <span className="fbg-num">{a.name}</span>
                      <Badge
                        tone={a.scanned ? "ok" : "neutral"}
                        icon={a.scanned ? "shield" : "clock"}
                      >
                        {a.scanned ? "已通过安全扫描" : "扫描中"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>

            {rfq.spec.length > 0 ? (
              <Panel
                title="买家确认的规格"
                description="只读。标注“必须匹配”的项目若有差异，平台会将您的报价归入“规格不同，不可比较”。"
                padded={false}
              >
                <table className="w-full text-sm">
                  <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
                    <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                      <th scope="col">项目</th>
                      <th scope="col">要求</th>
                      <th scope="col" className="text-right">
                        匹配要求
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--fbg-border-subtle)">
                    {rfq.spec.map((s) => (
                      <tr key={s.en} className="[&>td]:px-5 [&>td]:py-2.5">
                        <td>
                          <span className="block text-(--fbg-text-primary)">{s.zh}</span>
                          <span className="block text-xs text-(--fbg-text-secondary)" lang="en-US">
                            {s.en}
                          </span>
                        </td>
                        <td className="fbg-num text-(--fbg-text-primary)">{s.value}</td>
                        <td className="text-right">
                          {s.hard ? (
                            <Badge tone="ink" icon={null}>
                              必须匹配
                            </Badge>
                          ) : (
                            <Badge tone="neutral" icon={null}>
                              可有差异
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rfq.notes ? (
                  <p className="border-t border-(--fbg-border-subtle) px-5 py-3 text-sm text-(--fbg-text-secondary)">
                    买家备注：{rfq.notes}
                  </p>
                ) : null}
              </Panel>
            ) : null}

            {rfq.clarification ? (
              <Notice
                tone="warn"
                icon="message"
                title={`平台澄清请求（${formatZhDate(rfq.clarification.askedAt)}）`}
              >
                <p className="text-(--fbg-text-primary)">{rfq.clarification.question}</p>
                <p className="mt-1 text-xs" lang="en-US">
                  {rfq.clarification.questionEn}
                </p>
              </Notice>
            ) : null}

            {/* 状态区 */}
            {rfq.status === "已报价" ? (
              <Notice
                tone="teal"
                icon="check"
                title={`报价已提交，待平台审核（${formatZhDate(rfq.submittedAt ?? TODAY)}）`}
              >
                平台运营核对后转达买家。审核期间您可以撤回报价；已转达的报价只能通过新版本更新。
              </Notice>
            ) : null}
            {rfq.status === "已拒绝" ? (
              <Notice tone="neutral" title="您已拒绝此询价">
                平台已通知买家。如情况变化，请联系平台运营重新开启。
              </Notice>
            ) : null}

            {/* 操作 */}
            {(rfq.status === "待回复" || rfq.status === "需要澄清") && mode === "view" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon="check"
                  onClick={() => {
                    setDraft(prefillFor(rfq));
                    setMode("quote");
                  }}
                >
                  接受并报价
                </Button>
                <Button icon="message" onClick={() => setMode("clarify")}>
                  {rfq.status === "需要澄清" ? "回复澄清" : "需要澄清"}
                </Button>
                <Button variant="danger" onClick={() => setMode("decline")}>
                  拒绝
                </Button>
              </div>
            ) : null}

            {mode === "clarify" ? (
              <Panel title={rfq.status === "需要澄清" ? "回复平台澄清" : "向买家提问"}>
                <Field
                  label="您的回复 / 问题"
                  htmlFor="clarify"
                  required
                  optionalText="（可选）"
                  hint="平台运营会翻译并转达给买家。请勿在此填写联系方式。"
                >
                  <TextArea
                    id="clarify"
                    value={clarifyReply}
                    onChange={(e) => setClarifyReply(e.target.value)}
                    placeholder={
                      rfq.status === "需要澄清"
                        ? "交易条款为 EXW 东莞；刀模费 ¥1,200 一次性收取，未包含在单价内。"
                        : "请问标签是否需要分卷包装？每卷数量是否可以调整为 1,000？"
                    }
                  />
                </Field>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button onClick={() => setMode("view")}>取消</Button>
                  <Button
                    variant="primary"
                    disabled={clarifyReply.trim().length < 5}
                    onClick={() => {
                      patchRfq(rfq.id, {
                        status: "待回复",
                        clarification: undefined,
                        notes: rfq.notes,
                      });
                      setMode("view");
                      setClarifyReply("");
                    }}
                  >
                    提交给平台
                  </Button>
                </div>
              </Panel>
            ) : null}

            {mode === "decline" ? (
              <Panel title="拒绝询价">
                <Field label="原因" htmlFor="declineReason" required optionalText="（可选）">
                  <Select
                    id="declineReason"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  >
                    <option value="">请选择</option>
                    <option value="moq">数量低于起订量</option>
                    <option value="spec">规格超出生产能力</option>
                    <option value="capacity">近期产能已满</option>
                    <option value="other">其他</option>
                  </Select>
                </Field>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button onClick={() => setMode("view")}>取消</Button>
                  <Button
                    variant="danger"
                    disabled={!declineReason}
                    onClick={() => {
                      patchRfq(rfq.id, { status: "已拒绝" });
                      setMode("view");
                    }}
                  >
                    确认拒绝
                  </Button>
                </div>
              </Panel>
            ) : null}

            {mode === "quote" && draft ? (
              <div className="flex flex-col gap-4">
                <Panel
                  title="提交报价"
                  description="字段与平台的报价结构一致。提交后由平台审核；审核通过的报价会标注为“工厂确认报价”。"
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="货币" htmlFor="q-currency" required optionalText="（可选）">
                      <Select
                        id="q-currency"
                        value={draft.currency}
                        onChange={(e) =>
                          setDraft({ ...draft, currency: e.target.value as QuoteDraft["currency"] })
                        }
                      >
                        <option value="CNY">人民币 ¥ CNY</option>
                        <option value="USD">美元 $ USD</option>
                      </Select>
                    </Field>
                    <Field label="计价单位" htmlFor="q-unit" required optionalText="（可选）">
                      <Select
                        id="q-unit"
                        value={draft.unit}
                        onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                      >
                        {["件", "套", "卷", "箱", "千克"].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="交易条款（Incoterms 2020）"
                      htmlFor="q-basis"
                      required
                      optionalText="（可选）"
                      hint={
                        basisIssue?.level === "warning"
                          ? basisIssue.message
                          : "请使用正式条款代码并填写指定地点。"
                      }
                    >
                      <Select
                        id="q-basis"
                        value={draft.basisCode}
                        onChange={(e) =>
                          setDraft({ ...draft, basisCode: e.target.value as IncotermCode })
                        }
                      >
                        {(Object.keys(INCOTERM_GLOSS) as IncotermCode[]).map((code) => (
                          <option key={code} value={code}>
                            {INCOTERM_GLOSS[code]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="指定地点"
                      htmlFor="q-place"
                      required={draft.basisCode !== "EXW" && draft.basisCode !== "unknown"}
                      optionalText="（可选）"
                      error={basisIssue?.level === "error" ? basisIssue.message : undefined}
                    >
                      <TextInput
                        id="q-place"
                        value={draft.basisPlace}
                        placeholder="深圳"
                        onChange={(e) => setDraft({ ...draft, basisPlace: e.target.value })}
                        aria-invalid={basisIssue?.level === "error"}
                      />
                    </Field>
                  </div>
                </Panel>

                <Panel
                  title="阶梯价格"
                  description={`买家采购数量为 ${new Intl.NumberFormat("zh-CN").format(rfq.quantity)} ${rfq.unit}，平台将选取覆盖该数量的档位。`}
                >
                  <TierTable
                    idPrefix={`q-${rfq.id}`}
                    tiers={draft.tiers}
                    onChange={(tiers) => setDraft({ ...draft, tiers })}
                    currency={draft.currency}
                    unit={draft.unit}
                  />
                </Panel>

                <Panel title="费用、交期、付款与有效期">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      label={`模具 / 刀模费（${draft.currency === "CNY" ? "¥ CNY" : "$ USD"}，一次性）`}
                      htmlFor="q-tooling"
                      optionalText="（可选）"
                    >
                      <TextInput
                        id="q-tooling"
                        inputMode="decimal"
                        className="fbg-num"
                        value={draft.toolingAmount}
                        onChange={(e) => setDraft({ ...draft, toolingAmount: e.target.value })}
                      />
                    </Field>
                    <div className="sm:pt-7">
                      <Checkbox
                        id="q-toolingIncluded"
                        label="模具费已包含在单价内"
                        checked={draft.toolingIncluded}
                        onChange={(on) => setDraft({ ...draft, toolingIncluded: on })}
                      />
                    </div>
                    <Field
                      label="生产交期（天，稿件确认后）"
                      htmlFor="q-lead"
                      optionalText="（可选）"
                    >
                      <TextInput
                        id="q-lead"
                        inputMode="numeric"
                        className="fbg-num"
                        value={draft.leadTimeDays}
                        onChange={(e) => setDraft({ ...draft, leadTimeDays: e.target.value })}
                      />
                    </Field>
                    <Field label="付款方式" htmlFor="q-payment" optionalText="（可选）">
                      <TextInput
                        id="q-payment"
                        value={draft.paymentTerms}
                        onChange={(e) => setDraft({ ...draft, paymentTerms: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="报价有效期至"
                      htmlFor="q-valid"
                      required
                      optionalText="（可选）"
                      hint="必填。未注明有效期的报价不会被视为长期有效。"
                    >
                      <TextInput
                        id="q-valid"
                        type="date"
                        className="fbg-num"
                        value={draft.validUntil}
                        onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="备注"
                      htmlFor="q-notes"
                      optionalText="（可选）"
                      className="sm:col-span-2"
                    >
                      <TextArea
                        id="q-notes"
                        value={draft.notes}
                        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        placeholder="与买家规格的差异、包装方式、可接受的替代材料等。请勿填写联系方式。"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Checkbox
                        id="q-spec"
                        label="我确认本报价按买家确认的规格版本报价；如有差异已在备注中说明"
                        description="平台会按“必须匹配”项目核对；未说明的差异将导致报价不可比较。"
                        checked={draft.specConfirmed}
                        onChange={(on) => setDraft({ ...draft, specConfirmed: on })}
                      />
                    </div>
                  </div>
                </Panel>

                <div className="sticky bottom-16 z-20 flex flex-col gap-3 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)/95 p-4 backdrop-blur md:bottom-4">
                  {gate.length > 0 ? (
                    <Notice tone="warn" title={`还有 ${gate.length} 项需要完成`}>
                      {gate.join("；")}。
                    </Notice>
                  ) : (
                    <Notice tone="ok" title="可以提交">
                      此报价仅用于该买家的比较（可见范围：仅此买家），不会用于其他买家或公开展示。
                    </Notice>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button onClick={() => setMode("view")}>取消</Button>
                    <Button
                      variant="primary"
                      icon="upload"
                      disabled={gate.length > 0}
                      title={gate.length > 0 ? gate.join("；") : undefined}
                      onClick={() => {
                        patchRfq(rfq.id, {
                          status: "已报价",
                          submittedAt: TODAY,
                          clarification: undefined,
                        });
                        setMode("view");
                        setDraft(null);
                      }}
                    >
                      提交报价（待平台审核）
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
