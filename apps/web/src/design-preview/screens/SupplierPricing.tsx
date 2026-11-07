"use client";

/**
 * 阶梯报价 editor (IA §2.3 `/supplier/catalog/[id]/pricing`). Simplified-Chinese first. Local state only.
 * Rules: ascending non-overlapping tiers; Incoterm code + 指定地点; colloquial terms never defaulted; validity
 * required for confirmation; visibility is a declared intent — only a recorded grant makes prices visible.
 */
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  INCOTERM_GLOSS,
  SUPPLIER_PRODUCTS,
  type IncotermCode,
  type SupplierProduct,
  type SupplierTier,
  type ZhVisibility,
} from "../demo-data/supplier";
import { formatZhDate, validateBasis, validateTiers } from "../supplier-demo";
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
  Select,
  TextInput,
  cx,
  type Tone,
} from "../ui/primitives";
import { TierTable } from "../ui/TierTable";

const PRICE_TONE: Record<string, Tone> = {
  已确认: "ok",
  待确认: "warn",
  有效期未确认: "warn",
  即将过期: "warn",
  已过期: "danger",
  已暂停: "neutral",
  待平台审核: "teal",
};

const VISIBILITY: ReadonlyArray<{ value: ZhVisibility; label: string; hint: string }> = [
  { value: "仅内部", label: "仅内部", hint: "仅平台被指派的运营人员可见；买家不可见。" },
  { value: "平台买家", label: "平台买家", hint: "在您签署目录授权后，对平台上的买家可见。" },
  { value: "指定买家", label: "指定买家", hint: "仅对您指定且已记录授权的买家可见。" },
];

interface Draft {
  currency: "CNY" | "USD";
  unit: string;
  basisCode: IncotermCode;
  basisPlace: string;
  tiers: SupplierTier[];
  toolingAmount: string;
  toolingIncluded: boolean;
  leadTimeDays: string;
  validUntil: string;
  visibility: ZhVisibility;
  status: string;
  confirmedAt: string | null;
}

function draftFrom(p: SupplierProduct): Draft {
  return {
    currency: p.currency,
    unit: p.unit,
    basisCode: p.basis.code,
    basisPlace: p.basis.place,
    tiers: p.tiers.map((t) => ({ ...t })),
    toolingAmount: p.toolingFee ? String(p.toolingFee.amount) : "",
    toolingIncluded: p.toolingFee?.included ?? false,
    leadTimeDays: p.leadTimeDays !== null ? String(p.leadTimeDays) : "",
    validUntil: p.validUntil ?? "",
    visibility: p.visibility,
    status: p.status,
    confirmedAt: p.confirmedAt,
  };
}

export function SupplierPricing() {
  return (
    <Suspense fallback={null}>
      <SupplierPricingInner />
    </Suspense>
  );
}

function SupplierPricingInner() {
  const params = useSearchParams();
  const initialId = params?.get("product") ?? SUPPLIER_PRODUCTS[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(initialId);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(SUPPLIER_PRODUCTS.map((p) => [p.id, draftFrom(p)])),
  );
  const [message, setMessage] = useState<string | null>(null);

  const product = SUPPLIER_PRODUCTS.find((p) => p.id === selectedId) ?? SUPPLIER_PRODUCTS[0];
  const draft = product ? drafts[product.id] : undefined;

  const tierCheck = useMemo(() => (draft ? validateTiers(draft.tiers) : null), [draft]);
  const basisIssue = draft ? validateBasis(draft.basisCode, draft.basisPlace) : null;
  const validityMissing = !draft || !/^\d{4}-\d{2}-\d{2}$/.test(draft.validUntil);
  const canConfirm =
    !!draft &&
    !!tierCheck &&
    tierCheck.errors.length === 0 &&
    basisIssue?.level !== "error" &&
    !validityMissing &&
    draft.basisCode !== "unknown";

  const update = (patch: Partial<Draft>) => {
    if (!product) return;
    setMessage(null);
    setDrafts((d) => ({ ...d, [product.id]: { ...(d[product.id] as Draft), ...patch } }));
  };

  if (!product || !draft) return null;

  const blocking: string[] = [];
  if (tierCheck && tierCheck.errors.length > 0) blocking.push("阶梯价格有误");
  if (basisIssue?.level === "error") blocking.push("交易条款缺少指定地点");
  if (draft.basisCode === "unknown") blocking.push("交易条款未注明");
  if (validityMissing) blocking.push("未填写有效期");

  return (
    <AppShell workspace="supplier" title="阶梯报价">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="阶梯报价"
          lead="按数量区间填写单价。平台按买家的采购数量自动选取对应档位；交易条款与有效期是买家能否纳入比较的前提。"
          meta={
            <Badge tone="neutral" icon="info">
              买家看到的始终是您确认过的版本；修改后需重新确认
            </Badge>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
          {/* 产品列表 */}
          <Panel title="产品" padded={false} className="lg:sticky lg:top-20 lg:self-start">
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {SUPPLIER_PRODUCTS.map((p) => {
                const d = drafts[p.id];
                const active = p.id === product.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(p.id);
                        setMessage(null);
                      }}
                      aria-pressed={active}
                      className={cx(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-(--fbg-hover)",
                        active && "bg-(--fbg-selected)",
                      )}
                    >
                      <span className="text-sm font-medium text-(--fbg-text-primary)">
                        {p.nameZh}
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        <Badge tone={PRICE_TONE[d?.status ?? p.status] ?? "neutral"}>
                          {d?.status ?? p.status}
                        </Badge>
                        <Badge tone="neutral" icon={null}>
                          {d?.visibility ?? p.visibility}
                        </Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* 编辑器 */}
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              title={product.nameZh}
              description={
                <span>
                  {product.nameEn} · 规格版本 {product.specVersion}
                  {draft.confirmedAt
                    ? ` · 上次确认 ${formatZhDate(draft.confirmedAt)}`
                    : " · 尚未确认"}
                </span>
              }
              actions={<Badge tone={PRICE_TONE[draft.status] ?? "neutral"}>{draft.status}</Badge>}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="货币" htmlFor="currency" required optionalText="（可选）">
                  <Select
                    id="currency"
                    value={draft.currency}
                    onChange={(e) => update({ currency: e.target.value as Draft["currency"] })}
                  >
                    <option value="CNY">人民币 ¥ CNY</option>
                    <option value="USD">美元 $ USD</option>
                  </Select>
                </Field>
                <Field label="计价单位" htmlFor="unit" required optionalText="（可选）">
                  <Select
                    id="unit"
                    value={draft.unit}
                    onChange={(e) => update({ unit: e.target.value })}
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
                  htmlFor="basisCode"
                  required
                  optionalText="（可选）"
                  hint="请使用正式条款代码；“出厂价”“离岸价”等口语说法将被记录为“未注明”。"
                >
                  <Select
                    id="basisCode"
                    value={draft.basisCode}
                    onChange={(e) => update({ basisCode: e.target.value as IncotermCode })}
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
                  htmlFor="basisPlace"
                  required={draft.basisCode !== "EXW" && draft.basisCode !== "unknown"}
                  optionalText="（可选）"
                  error={basisIssue?.level === "error" ? basisIssue.message : undefined}
                  hint={
                    basisIssue?.level === "warning" ? basisIssue.message : "例如：深圳、宁波、东莞"
                  }
                >
                  <TextInput
                    id="basisPlace"
                    value={draft.basisPlace}
                    placeholder="深圳"
                    onChange={(e) => update({ basisPlace: e.target.value })}
                    aria-invalid={basisIssue?.level === "error"}
                  />
                </Field>
              </div>
              {product.basis.colloquial && draft.basisCode === "unknown" ? (
                <div className="mt-4">
                  <Notice tone="warn" title={`原始报价单上写的是“${product.basis.colloquial}”`}>
                    平台不会把“{product.basis.colloquial}”自动当作
                    EXW。请在上方选择正式条款并填写地点，否则该价格无法向买家展示。
                  </Notice>
                </div>
              ) : null}
            </Panel>

            <Panel
              title="阶梯价格"
              description="数量区间为左闭右开：例如 5,000 – 9,999 与 10,000 – 49,999。各档起订量须递增且不得重叠。"
            >
              <TierTable
                idPrefix={`tier-${product.id}`}
                tiers={draft.tiers}
                onChange={(tiers) => update({ tiers })}
                currency={draft.currency}
                unit={draft.unit}
              />
            </Panel>

            <Panel title="费用、交期与有效期">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={`模具 / 刀模费（${draft.currency === "CNY" ? "¥ CNY" : "$ USD"}，一次性）`}
                  htmlFor="tooling"
                  optionalText="（可选）"
                >
                  <TextInput
                    id="tooling"
                    inputMode="decimal"
                    className="fbg-num"
                    value={draft.toolingAmount}
                    placeholder="0"
                    onChange={(e) => update({ toolingAmount: e.target.value })}
                  />
                </Field>
                <div className="sm:pt-7">
                  <Checkbox
                    id="toolingIncluded"
                    label="模具费已包含在单价内"
                    description="勾选后，买家的比较中不再单列模具费。"
                    checked={draft.toolingIncluded}
                    onChange={(on) => update({ toolingIncluded: on })}
                  />
                </div>
                <Field label="生产交期（天，稿件确认后）" htmlFor="lead" optionalText="（可选）">
                  <TextInput
                    id="lead"
                    inputMode="numeric"
                    className="fbg-num"
                    value={draft.leadTimeDays}
                    placeholder="15"
                    onChange={(e) => update({ leadTimeDays: e.target.value })}
                  />
                </Field>
                <Field
                  label="报价有效期至"
                  htmlFor="validUntil"
                  required
                  optionalText="（可选）"
                  error={
                    validityMissing
                      ? "请填写具体日期。未注明有效期的价格不会被视为长期有效。"
                      : undefined
                  }
                >
                  <TextInput
                    id="validUntil"
                    type="date"
                    className="fbg-num"
                    value={draft.validUntil}
                    onChange={(e) => update({ validUntil: e.target.value })}
                    aria-invalid={validityMissing}
                  />
                </Field>
              </div>
            </Panel>

            <Panel
              title="可见范围"
              description="这里记录的是您的意愿。买家实际能否看到价格，取决于平台记录的授权；撤销授权后立即不可见。"
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {VISIBILITY.map((v) => {
                  const selected = draft.visibility === v.value;
                  return (
                    <label
                      key={v.value}
                      className={cx(
                        "flex cursor-pointer items-start gap-3 rounded-(--fbg-radius-control) border p-3",
                        selected
                          ? "border-(--fbg-action-primary)/60 bg-(--fbg-selected)"
                          : "border-(--fbg-border-subtle) hover:border-(--fbg-border-strong)",
                      )}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        className="mt-0.5 accent-(--fbg-action-primary)"
                        checked={selected}
                        onChange={() => update({ visibility: v.value })}
                      />
                      <span>
                        <span className="block text-[15px] font-medium text-(--fbg-text-primary)">
                          {v.label}
                        </span>
                        <span className="block text-sm text-(--fbg-text-secondary)">{v.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {draft.visibility === "指定买家" ? (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-(--fbg-text-secondary)">
                  已授权买家：
                  {(product.namedBuyers ?? []).length === 0 ? (
                    <span>暂无</span>
                  ) : (
                    product.namedBuyers?.map((b) => (
                      <Badge key={b} tone="teal" icon="check">
                        {b}
                      </Badge>
                    ))
                  )}
                  <Button size="sm" variant="ghost" icon="plus" disabled title="原型中暂未提供">
                    添加买家（需平台确认）
                  </Button>
                </p>
              ) : null}
            </Panel>

            {/* 操作 */}
            <div className="sticky bottom-16 z-20 flex flex-col gap-3 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)/95 p-4 backdrop-blur md:bottom-4">
              {message ? (
                <Notice tone="ok" title={message}>
                  原型：仅本地记录。正式系统中会生成新的报价版本并写入审计记录。
                </Notice>
              ) : blocking.length > 0 ? (
                <Notice tone="warn" title="尚不能确认有效">
                  {blocking.join("；")}。
                </Notice>
              ) : (
                <Notice tone="ok" title="可以确认">
                  确认后，买家看到的将是本版本；有效期至 {formatZhDate(draft.validUntil)}。
                </Notice>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="danger"
                  icon="x"
                  onClick={() => {
                    update({ status: "已暂停" });
                    setMessage("产品已暂停，买家将不再看到此价格");
                  }}
                >
                  暂停产品
                </Button>
                <Button
                  icon="upload"
                  disabled={!tierCheck || tierCheck.errors.length > 0}
                  onClick={() => {
                    update({ status: "待平台审核" });
                    setMessage("报价已提交，待平台审核");
                  }}
                >
                  更新报价
                </Button>
                <Button
                  variant="primary"
                  icon="check"
                  disabled={!canConfirm}
                  title={!canConfirm ? blocking.join("；") : undefined}
                  onClick={() => {
                    update({ status: "已确认", confirmedAt: "2026-11-07" });
                    setMessage(`已确认有效，有效期至 ${formatZhDate(draft.validUntil)}`);
                  }}
                >
                  确认有效
                </Button>
              </div>
              <p className="flex items-start gap-1 text-xs text-(--fbg-text-secondary)">
                <Icon name="lock" size={12} className="mt-0.5 shrink-0" />
                平台不会修改您的价格；运营人员只能标记需要您确认的问题。
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
