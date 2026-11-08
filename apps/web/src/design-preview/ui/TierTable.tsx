"use client";

/**
 * 阶梯价格编辑器 (price-tier editor), shared by the supplier pricing screen and the quote submission form.
 * Rules come from `supplier-demo.ts` (display-only mirror of QUOTE_ENGINE_SPEC §2.3). Local state only.
 */
import type { SupplierTier } from "../demo-data/supplier";
import { formatZhMoney, tierRangeZh, validateTiers, type TierIssue } from "../supplier-demo";
import { Icon } from "./icons";
import { Badge, Button, TextInput, cx } from "./primitives";

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[,，\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function TierTable({
  tiers,
  onChange,
  currency,
  unit,
  idPrefix,
}: {
  tiers: SupplierTier[];
  onChange: (next: SupplierTier[]) => void;
  currency: "CNY" | "USD";
  unit: string;
  idPrefix: string;
}) {
  const validation = validateTiers(tiers);
  const issuesFor = (row: number): TierIssue[] => [
    ...validation.errors.filter((i) => i.row === row),
    ...validation.warnings.filter((i) => i.row === row),
  ];
  const update = (id: number, patch: Partial<SupplierTier>) =>
    onChange(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: number) => onChange(tiers.filter((t) => t.id !== id));
  const add = () => {
    const last = tiers[tiers.length - 1];
    onChange([
      ...tiers,
      {
        id: Date.now(),
        minQty: last?.maxQty ?? null,
        maxQty: null,
        unitPrice: null,
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden grid-cols-[2.5rem_1fr_1fr_1fr_2.5rem] gap-2 px-1 text-xs text-(--fbg-text-secondary) sm:grid">
        <span>档</span>
        <span>起订量（{unit}）</span>
        <span>区间上限（不含，留空为不封顶）</span>
        <span>
          单价（{currency === "CNY" ? "¥ CNY" : "$ USD"} / {unit}）
        </span>
        <span className="sr-only">操作</span>
      </div>
      <ol className="flex flex-col gap-2">
        {tiers.map((t, i) => {
          const issues = issuesFor(i + 1);
          const hasError = issues.some((x) =>
            ["min_required", "price_required", "max_le_min", "not_ascending", "overlap"].includes(
              x.code,
            ),
          );
          return (
            <li
              key={t.id}
              className={cx(
                "rounded-(--fbg-radius-control) border p-2",
                hasError ? "border-(--fbg-status-danger)/50" : "border-(--fbg-border-subtle)",
              )}
            >
              <div className="grid grid-cols-[2.5rem_1fr_2.5rem] gap-2 sm:grid-cols-[2.5rem_1fr_1fr_1fr_2.5rem]">
                <span className="fbg-num flex h-(--fbg-control-h) items-center justify-center text-sm font-semibold text-(--fbg-text-secondary)">
                  {i + 1}
                </span>
                <div className="contents sm:contents">
                  <div className="col-span-1 flex flex-col gap-2 sm:contents">
                    <label className="sr-only" htmlFor={`${idPrefix}-min-${t.id}`}>
                      第 {i + 1} 档起订量
                    </label>
                    <TextInput
                      id={`${idPrefix}-min-${t.id}`}
                      inputMode="numeric"
                      placeholder="起订量"
                      className="fbg-num"
                      value={t.minQty ?? ""}
                      onChange={(e) => update(t.id, { minQty: parseNumber(e.target.value) })}
                      aria-invalid={issues.some((x) =>
                        ["min_required", "not_ascending", "overlap"].includes(x.code),
                      )}
                    />
                    <label className="sr-only" htmlFor={`${idPrefix}-max-${t.id}`}>
                      第 {i + 1} 档区间上限
                    </label>
                    <TextInput
                      id={`${idPrefix}-max-${t.id}`}
                      inputMode="numeric"
                      placeholder="不封顶"
                      className="fbg-num"
                      value={t.maxQty ?? ""}
                      onChange={(e) => update(t.id, { maxQty: parseNumber(e.target.value) })}
                      aria-invalid={issues.some((x) => x.code === "max_le_min")}
                    />
                    <label className="sr-only" htmlFor={`${idPrefix}-price-${t.id}`}>
                      第 {i + 1} 档单价
                    </label>
                    <TextInput
                      id={`${idPrefix}-price-${t.id}`}
                      inputMode="decimal"
                      placeholder="单价"
                      className="fbg-num"
                      value={t.unitPrice ?? ""}
                      onChange={(e) => update(t.id, { unitPrice: parseNumber(e.target.value) })}
                      aria-invalid={issues.some((x) => x.code === "price_required")}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  icon="x"
                  aria-label={`删除第 ${i + 1} 档`}
                  disabled={tiers.length === 1}
                  onClick={() => remove(t.id)}
                />
              </div>
              {issues.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-0.5 px-1">
                  {issues.map((x) => (
                    <li
                      key={x.code + x.row}
                      className={cx(
                        "flex items-start gap-1 text-xs",
                        ["gap", "non_monotonic"].includes(x.code)
                          ? "text-(--fbg-status-warning)"
                          : "text-(--fbg-status-danger)",
                      )}
                    >
                      <Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {x.message}
                    </li>
                  ))}
                </ul>
              ) : t.minQty !== null && t.unitPrice !== null ? (
                <p className="fbg-num mt-1.5 px-1 text-xs text-(--fbg-text-secondary)">
                  {tierRangeZh(t)} {unit} · {formatZhMoney(t.unitPrice, currency, 4)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" icon="plus" onClick={add}>
          添加档位
        </Button>
        {validation.errors.length === 0 ? (
          <Badge tone="ok">阶梯区间有效，无重叠</Badge>
        ) : (
          <Badge tone="danger">{validation.errors.length} 处需要修正</Badge>
        )}
      </div>
    </div>
  );
}
