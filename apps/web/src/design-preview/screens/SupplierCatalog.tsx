"use client";

/**
 * 供应商工作台：产品目录 (IA `/supplier/catalog`). The list of products with their price state and
 * visibility, 新增产品 (a product without prices, to be priced and confirmed in 阶梯报价), 暂停 / 恢复,
 * and a 依据 drawer that explains what each visibility means and that unconfirmed prices never
 * reach a buyer. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SUPPLIER_PRODUCTS,
  type SupplierProduct,
  type ZhPriceStatus,
  type ZhVisibility,
} from "../demo-data/supplier";
import { CATALOG_TODAY } from "../demo-data/supplier-import";
import {
  PRICE_TONE,
  VISIBILITY_EXPLANATION,
  basisText,
  catalogSummary,
  newProduct,
  toggleSuspended,
  validateNewProduct,
} from "../supplier-catalog-demo";
import { daysUntil, formatZhDate, formatZhMoney, formatZhQty, tierRangeZh } from "../supplier-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  Field,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  Select,
  Tabs,
  TextInput,
  cx,
} from "../ui/primitives";

type Filter = "全部" | "待确认" | "已确认" | "即将过期" | "已过期" | "已暂停";

const FILTER_MATCH: Record<Filter, (s: ZhPriceStatus) => boolean> = {
  全部: () => true,
  待确认: (s) => s === "待确认" || s === "有效期未确认",
  已确认: (s) => s === "已确认",
  即将过期: (s) => s === "即将过期",
  已过期: (s) => s === "已过期",
  已暂停: (s) => s === "已暂停",
};

const SCOPES: ZhVisibility[] = ["仅内部", "平台买家", "指定买家"];

interface NewForm {
  nameZh: string;
  nameEn: string;
  specVersion: string;
  unit: string;
  currency: "CNY" | "USD";
  visibility: ZhVisibility;
}

const EMPTY_FORM: NewForm = {
  nameZh: "",
  nameEn: "",
  specVersion: "v1",
  unit: "件",
  currency: "CNY",
  visibility: "仅内部",
};

export function SupplierCatalog() {
  const [products, setProducts] = useState<SupplierProduct[]>(SUPPLIER_PRODUCTS);
  const [filter, setFilter] = useState<Filter>("全部");
  const [scope, setScope] = useState<ZhVisibility | "全部">("全部");
  const [selectedId, setSelectedId] = useState<string | null>("sp_labels");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<NewForm>(EMPTY_FORM);
  const [created, setCreated] = useState<SupplierProduct | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const summary = useMemo(() => catalogSummary(products), [products]);
  const rows = useMemo(
    () =>
      products.filter(
        (p) => FILTER_MATCH[filter](p.status) && (scope === "全部" || p.visibility === scope),
      ),
    [products, filter, scope],
  );
  const countFor = (f: Filter) => products.filter((p) => FILTER_MATCH[f](p.status)).length;
  const selected = products.find((p) => p.id === selectedId) ?? null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const formErrors = validateNewProduct(form);
  const create = () => {
    if (formErrors.length > 0) return;
    const p = newProduct(form, products.filter((x) => x.id.startsWith("sp_new_")).length + 1);
    setProducts((prev) => [p, ...prev]);
    setCreated(p);
    setSelectedId(p.id);
    setForm(EMPTY_FORM);
    setShowNew(false);
    note(`已创建产品“${p.nameZh}”（待确认，尚无价格）`);
  };

  const toggle = (p: SupplierProduct) => {
    const next = toggleSuspended(p);
    setProducts((prev) => prev.map((x) => (x.id === p.id ? next : x)));
    note(
      next.status === "已暂停"
        ? `已暂停“${p.nameZh}”，买家不再看到此产品`
        : `已恢复“${p.nameZh}”为待确认，请在阶梯报价中重新确认价格`,
    );
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">依据</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">买家看到什么</p>
      </div>
      {selected ? (
        <ProductFacts p={selected} />
      ) : (
        <p className="text-(--fbg-text-secondary)">请选择一个产品。</p>
      )}
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">规则</p>
        <ul className="mt-1 flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
          <li>未经您确认有效的价格，不会向任何买家展示。</li>
          <li>规格版本变更后，旧版本的报价仍保留记录，但买家比价只使用其询价所指定的版本。</li>
          <li>“数据共享设置”决定哪些字段可以向买家展示；可见范围决定展示给谁。</li>
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">本次操作记录</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            暂无。新增、暂停与恢复均记录在审计日志中。
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
    <AppShell workspace="supplier" title="产品目录" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="产品目录"
          lead="您的产品与阶梯报价清单。未经您确认的价格不会向买家展示；可见范围决定哪些买家能看到已确认的价格。"
          meta={
            <>
              <Badge tone="neutral" icon={null} className="fbg-num">
                {summary.total} 个产品
              </Badge>
              <Badge tone="ok" icon="check" className="fbg-num">
                {summary.已确认} 已确认
              </Badge>
              <Badge tone={summary.待确认 > 0 ? "warn" : "neutral"} icon={null} className="fbg-num">
                {summary.待确认} 待确认
              </Badge>
              <Badge
                tone={summary.即将过期 + summary.已过期 > 0 ? "warn" : "neutral"}
                icon={summary.即将过期 + summary.已过期 > 0 ? "alert" : null}
                className="fbg-num"
              >
                {summary.即将过期 + summary.已过期} 需续期
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                截至 {formatZhDate(CATALOG_TODAY)}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/design-preview/supplier/catalog/import"
                className={buttonClasses("secondary")}
              >
                <Icon name="upload" size={16} />
                批量导入
              </Link>
              <Button variant="primary" icon="plus" onClick={() => setShowNew((v) => !v)}>
                新增产品
              </Button>
            </div>
          }
        />

        {created ? (
          <Notice
            tone="ok"
            title={`已创建“${created.nameZh}”`}
            action={
              <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
                关闭
              </Button>
            }
          >
            产品处于待确认状态，尚无价格。请在阶梯报价中填写数量区间、单价、交易条款与有效期，并确认有效；在此之前买家看不到它。本预览不保存新产品，阶梯报价编辑器仅含示例产品。
          </Notice>
        ) : null}

        {showNew ? (
          <Panel
            title="新增产品"
            description="先登记产品，再到阶梯报价填写价格。产品名称（中文）用于匹配批量导入的行，请保持唯一。"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="产品名称（中文）" htmlFor="np-zh" required>
                <TextInput
                  id="np-zh"
                  value={form.nameZh}
                  onChange={(e) => setForm({ ...form, nameZh: e.target.value })}
                  placeholder="例如：PET 透明标签 60 × 40 mm"
                />
              </Field>
              <Field
                label="产品名称（英文）"
                htmlFor="np-en"
                optionalText="（可选，留空由平台翻译）"
              >
                <TextInput
                  id="np-en"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="PET clear labels 60 × 40 mm"
                />
              </Field>
              <Field label="规格版本" htmlFor="np-spec" required>
                <TextInput
                  id="np-spec"
                  value={form.specVersion}
                  onChange={(e) => setForm({ ...form, specVersion: e.target.value })}
                />
              </Field>
              <Field label="单位" htmlFor="np-unit" required>
                <TextInput
                  id="np-unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </Field>
              <Field label="货币" htmlFor="np-cur" required>
                <Select
                  id="np-cur"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value as "CNY" | "USD" })}
                >
                  <option value="CNY">CNY 人民币</option>
                  <option value="USD">USD 美元</option>
                </Select>
              </Field>
              <Field label="可见范围" htmlFor="np-vis" required>
                <Select
                  id="np-vis"
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value as ZhVisibility })}
                >
                  {SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="mt-2 text-xs text-(--fbg-text-secondary)">
              {VISIBILITY_EXPLANATION[form.visibility]}
            </p>
            {form.nameZh.length > 0 && formErrors.length > 0 ? (
              <p className="mt-2 text-xs text-(--fbg-status-danger)">{formErrors.join("；")}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" disabled={formErrors.length > 0} onClick={create}>
                创建产品
              </Button>
              <Button onClick={() => setShowNew(false)}>取消</Button>
            </div>
          </Panel>
        ) : null}

        <Tabs
          label="价格状态"
          value={filter}
          onChange={setFilter}
          tabs={(["全部", "待确认", "已确认", "即将过期", "已过期", "已暂停"] as Filter[]).map(
            (f) => ({
              value: f,
              label: f,
              count: countFor(f),
            }),
          )}
        />

        <Panel padded={false}>
          <div className="flex flex-col gap-2 border-b border-(--fbg-border-subtle) p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              aria-label="可见范围筛选"
              value={scope}
              onChange={(e) => setScope(e.target.value as ZhVisibility | "全部")}
              className="min-w-0 sm:max-w-56 sm:flex-1 sm:basis-44"
            >
              <option value="全部">全部可见范围</option>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <span className="fbg-num text-xs whitespace-nowrap text-(--fbg-text-secondary) sm:ml-auto">
              显示 {rows.length} 个
            </span>
          </div>
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="没有符合条件的产品"
                body="请调整筛选条件，或新增产品。"
                icon="list"
              />
            </div>
          ) : (
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {rows.map((p) => {
                const active = p.id === selectedId;
                const left = daysUntil(p.validUntil, CATALOG_TODAY);
                const lowest = p.tiers.reduce<number | null>(
                  (min, t) =>
                    t.unitPrice === null
                      ? min
                      : min === null
                        ? t.unitPrice
                        : Math.min(min, t.unitPrice),
                  null,
                );
                return (
                  <li
                    key={p.id}
                    className={cx(
                      "flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between",
                      active && "bg-(--fbg-selected)",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      aria-pressed={active}
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 text-sm font-medium text-(--fbg-text-primary)">
                          {p.nameZh}
                        </span>
                        <Badge tone={PRICE_TONE[p.status]} icon={null}>
                          {p.status}
                        </Badge>
                        <Badge tone="neutral" icon={null}>
                          {p.visibility}
                        </Badge>
                      </span>
                      <span className="text-xs text-(--fbg-text-secondary)" lang="en-US">
                        {p.nameEn || "（英文名称待平台翻译）"}
                      </span>
                      <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                        规格 {p.specVersion} · {basisText(p)} · {p.currency} / {p.unit}
                        {p.tiers.length > 0 && lowest !== null
                          ? ` · ${p.tiers.length} 档，最低 ${formatZhMoney(lowest, p.currency, 2)}`
                          : " · 尚无价格"}
                      </span>
                      <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                        有效期至 {formatZhDate(p.validUntil)}
                        {left !== null
                          ? left < 0
                            ? `（已过期 ${-left} 天）`
                            : `（剩余 ${left} 天）`
                          : ""}
                        {p.confirmedAt ? ` · 确认于 ${formatZhDate(p.confirmedAt)}` : " · 未确认"}
                      </span>
                    </button>
                    <div className="flex min-w-0 flex-wrap gap-2 lg:shrink-0">
                      {p.id.startsWith("sp_new_") ? (
                        <span className="text-xs text-(--fbg-text-secondary)">
                          新产品：预览中不进入阶梯报价编辑器
                        </span>
                      ) : (
                        <Link
                          href={`/design-preview/supplier/pricing?product=${p.id}`}
                          className={buttonClasses("secondary", "sm")}
                        >
                          编辑阶梯报价
                        </Link>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => toggle(p)}>
                        {p.status === "已暂停" ? "恢复" : "暂停"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="xl:hidden">
          {selected ? (
            <Panel title="买家看到什么">
              <ProductFacts p={selected} />
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function ProductFacts({ p }: { p: SupplierProduct }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">{p.nameZh}</p>
        <p className="text-xs text-(--fbg-text-secondary)" lang="en-US">
          {p.nameEn || "（英文名称待平台翻译）"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={PRICE_TONE[p.status]} icon={null}>
            {p.status}
          </Badge>
          <Badge tone="neutral" icon={null}>
            {p.visibility}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-(--fbg-text-secondary)">
          {VISIBILITY_EXPLANATION[p.visibility]}
        </p>
        {p.visibility === "指定买家" ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            指定买家：
            {p.namedBuyers && p.namedBuyers.length > 0 ? p.namedBuyers.join("、") : "尚未指定"}
          </p>
        ) : null}
        {p.status !== "已确认" ? (
          <p className="mt-1 text-xs text-(--fbg-status-warning)">
            {p.status === "已暂停"
              ? "已暂停：买家看不到此产品。"
              : "价格未确认有效：买家看不到此价格。"}
          </p>
        ) : null}
      </div>
      <KeyValue
        columns={1}
        items={[
          { label: "规格版本", value: p.specVersion },
          { label: "交易条款", value: basisText(p) },
          { label: "货币 / 单位", value: `${p.currency} / ${p.unit}` },
          {
            label: "阶梯价格",
            value:
              p.tiers.length === 0 ? (
                "尚无价格"
              ) : (
                <ul className="fbg-num flex flex-col gap-0.5">
                  {p.tiers.map((t) => (
                    <li key={t.id}>
                      {tierRangeZh(t)} {p.unit} @{" "}
                      {t.unitPrice === null ? "—" : formatZhMoney(t.unitPrice, p.currency, 4)}
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            label: "模具费",
            value: p.toolingFee
              ? `${formatZhQty(p.toolingFee.amount)} ${p.currency}（${p.toolingFee.included ? "含在单价" : "不含单价，一次性"}）`
              : "无",
          },
          { label: "交期", value: p.leadTimeDays === null ? "未注明" : `${p.leadTimeDays} 天` },
          { label: "有效期至", value: formatZhDate(p.validUntil) },
          { label: "确认时间", value: p.confirmedAt ? formatZhDate(p.confirmedAt) : "未确认" },
        ]}
      />
    </div>
  );
}
