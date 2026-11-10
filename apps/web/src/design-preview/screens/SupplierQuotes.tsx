"use client";

/**
 * 供应商工作台：我的报价 (IA §2.3 `/supplier/quotes`; migration 0009 / ADR-021). One thread per RFQ
 * with its versions: 待审核 / 已确认 / 即将过期 / 已过期 / 已更新 / 已撤回. The current version's terms,
 * the tier table read-only, what the buyer sees, actions by state (撤销提交, 撤回报价 with a reason,
 * 更新报价 as a new version that enters review), and the version history with diffs and events.
 * Local state only; the platform confirms and supersedes, never this screen.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { INCOTERM_GLOSS, type IncotermCode } from "../demo-data/supplier";
import {
  QUOTES_TODAY,
  QUOTE_GROUPS,
  QUOTE_VERSIONS,
  type QuoteGroup,
  type QuoteVersion,
} from "../demo-data/supplier-quotes";
import {
  formatZhDate,
  formatZhMoney,
  formatZhQty,
  tierRangeZh,
  validateBasis,
} from "../supplier-demo";
import {
  QUOTE_STATUS_TONE,
  applyCancelSubmission,
  applyNewVersion,
  applyWithdraw,
  canCancelSubmission,
  canUpdate,
  canWithdraw,
  diffVersions,
  draftFromVersion,
  eventTextZh,
  newVersionGate,
  quotesSummary,
  sortGroups,
  statusExplanation,
  validityText,
  versionsOf,
  withdrawReasonError,
  zhStatus,
  type VersionDraft,
} from "../supplier-quotes-demo";
import { AppShell } from "../ui/AppShell";
import { TierTable } from "../ui/TierTable";
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
  SegmentedControl,
  Select,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";

type Filter = "全部" | "待审核" | "有效" | "已过期" | "已结束";
type Mode = "view" | "withdraw" | "cancel" | "update";

const INCOTERM_CODES = Object.keys(INCOTERM_GLOSS) as IncotermCode[];

export function SupplierQuotes({ initialGroupId }: { initialGroupId?: string | undefined }) {
  const [versions, setVersions] = useState<QuoteVersion[]>(QUOTE_VERSIONS);
  const [filter, setFilter] = useState<Filter>("全部");
  const [selectedId, setSelectedId] = useState<string>(
    initialGroupId && QUOTE_GROUPS.some((g) => g.id === initialGroupId)
      ? initialGroupId
      : (sortGroups(QUOTE_GROUPS, QUOTE_VERSIONS, QUOTES_TODAY)[0]?.id ?? ""),
  );
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<VersionDraft | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const summary = useMemo(() => quotesSummary(QUOTE_GROUPS, versions, QUOTES_TODAY), [versions]);
  const rows = useMemo(() => {
    const sorted = sortGroups(QUOTE_GROUPS, versions, QUOTES_TODAY);
    return sorted.filter((g) => {
      if (filter === "全部") return true;
      const all = versionsOf(g, versions);
      const pending = all.some(
        (v) => v.reviewStatus === "pending" || v.reviewStatus === "in_review",
      );
      const cur = all.find((v) => v.isCurrent);
      const st = cur ? zhStatus(cur, QUOTES_TODAY) : "已撤回";
      if (filter === "待审核") return pending;
      if (filter === "有效") return st === "已确认" || st === "即将过期";
      if (filter === "已过期") return st === "已过期";
      return st === "已撤回" || st === "已撤销提交" || st === "审核未通过";
    });
  }, [versions, filter]);
  const group = QUOTE_GROUPS.find((g) => g.id === selectedId) ?? null;
  const groupVersions = group ? versionsOf(group, versions) : [];
  const pending =
    groupVersions.find((v) => v.reviewStatus === "pending" || v.reviewStatus === "in_review") ??
    null;
  const current = groupVersions.find((v) => v.isCurrent) ?? null;
  const shown = pending ?? current;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);
  const now = () => `${QUOTES_TODAY} ${new Date().toISOString().slice(11, 16)}`;

  const select = (id: string) => {
    setSelectedId(id);
    setMode("view");
    setReason("");
    setDraft(null);
  };

  const withdraw = (v: QuoteVersion) => {
    if (withdrawReasonError(reason)) return;
    setVersions((prev) => prev.map((x) => (x.id === v.id ? applyWithdraw(x, reason, now()) : x)));
    note(`已撤回 v${v.version}（${group?.rfqRef}）：${reason.trim()}`);
    setMode("view");
    setReason("");
  };

  const cancel = (v: QuoteVersion) => {
    if (withdrawReasonError(reason)) return;
    setVersions((prev) =>
      prev.map((x) => (x.id === v.id ? applyCancelSubmission(x, reason, now()) : x)),
    );
    note(`已撤销提交 v${v.version}（${group?.rfqRef}）`);
    setMode("view");
    setReason("");
  };

  const submitNew = (prev: QuoteVersion) => {
    if (!draft || newVersionGate(draft, prev, QUOTES_TODAY).length > 0) return;
    const next = applyNewVersion(prev, draft, now(), QUOTES_TODAY);
    setVersions((list) => [...list, next]);
    note(`已提交 v${next.version}（${group?.rfqRef}），待平台审核`);
    setMode("view");
    setDraft(null);
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">说明</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">报价的状态与版本</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>提交的报价先由平台运营核对（待审核），确认后才转达买家。</li>
        <li>已确认的报价内容不可修改。调整价格、交期或有效期都会生成新版本，再次经平台审核。</li>
        <li>有效期必须是具体日期；未注明时买家会看到“有效期未确认”。</li>
        <li>撤回后买家看到“报价已撤回”，且不能恢复；需要新的询价才能重新报价。</li>
        <li>您的报价仅对该询价的买家可见；平台不会把报价展示给其他买家。</li>
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
    <AppShell workspace="supplier" title="我的报价" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="我的报价"
          lead="按询价查看您提交的报价及其版本。平台确认后买家才能看到；到期、撤回或被新版本替代时，买家的比较会同步更新。"
          meta={
            <>
              <Badge tone="teal" icon={null} className="fbg-num">
                待审核 {summary.pending}
              </Badge>
              <Badge
                tone={summary.expiring > 0 ? "warn" : "neutral"}
                icon="clock"
                className="fbg-num"
              >
                即将过期 {summary.expiring}
              </Badge>
              <Badge
                tone={summary.expired > 0 ? "danger" : "neutral"}
                icon={null}
                className="fbg-num"
              >
                已过期 {summary.expired}
              </Badge>
              <Badge tone="ok" icon="check" className="fbg-num">
                已确认 {summary.confirmed}
              </Badge>
            </>
          }
          actions={
            <Link href="/design-preview/supplier/rfqs" className={buttonClasses("secondary")}>
              查看询价单
            </Link>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <SegmentedControl
              label="筛选"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={(["全部", "待审核", "有效", "已过期", "已结束"] as Filter[]).map((f) => ({
                value: f,
                label: f,
              }))}
            />
            <Panel padded={false}>
              {rows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="没有符合条件的报价" body="换一个筛选条件。" icon="document" />
                </div>
              ) : (
                <ul className="divide-y divide-(--fbg-border-subtle)">
                  {rows.map((g) => {
                    const all = versionsOf(g, versions);
                    const p = all.find(
                      (v) => v.reviewStatus === "pending" || v.reviewStatus === "in_review",
                    );
                    const cur = all.find((v) => v.isCurrent);
                    const st = p ? "待审核" : cur ? zhStatus(cur, QUOTES_TODAY) : "已撤回";
                    const active = g.id === selectedId;
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => select(g.id)}
                          aria-pressed={active}
                          className={cx(
                            "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                            active && "bg-(--fbg-selected)",
                          )}
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={QUOTE_STATUS_TONE[st]} icon={null}>
                              {st}
                            </Badge>
                            {all.length > 1 ? (
                              <Badge tone="neutral" icon={null} className="fbg-num">
                                {all.length} 个版本
                              </Badge>
                            ) : null}
                          </span>
                          <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                            {g.productZh}
                          </span>
                          <span className="fbg-num truncate text-[11px] text-(--fbg-text-secondary)">
                            {g.rfqRef} · {formatZhQty(g.quantity)} {g.unit} ·{" "}
                            {cur ? validityText(cur, QUOTES_TODAY) : "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {group && shown ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-(--fbg-text-primary)">
                      {group.productZh}
                    </h2>
                    <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                      {group.productEn} · {group.rfqRef} · {group.buyerLabel} ·{" "}
                      {formatZhQty(group.quantity)} {group.unit} · {group.specVersion}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={QUOTE_STATUS_TONE[zhStatus(shown, QUOTES_TODAY)]} icon={null}>
                      {zhStatus(shown, QUOTES_TODAY)} · v{shown.version}
                    </Badge>
                    {group.rfqId ? (
                      <Link
                        href={`/design-preview/supplier/rfqs?rfq=${group.rfqId}`}
                        className={buttonClasses("ghost", "sm")}
                      >
                        查看询价
                      </Link>
                    ) : null}
                  </div>
                </div>

                <Notice
                  tone={
                    zhStatus(shown, QUOTES_TODAY) === "已过期" ||
                    zhStatus(shown, QUOTES_TODAY) === "即将过期"
                      ? "warn"
                      : "neutral"
                  }
                  title={zhStatus(shown, QUOTES_TODAY)}
                >
                  {statusExplanation(zhStatus(shown, QUOTES_TODAY))}
                  {pending && current
                    ? ` 当前对买家可见的仍是 v${current.version}（${zhStatus(current, QUOTES_TODAY)}）。`
                    : ""}
                </Notice>

                <VersionPanel v={shown} group={group} />

                {mode === "view" ? (
                  <div className="flex flex-wrap gap-2">
                    {canCancelSubmission(shown) ? (
                      <Button variant="secondary" onClick={() => setMode("cancel")}>
                        撤销提交
                      </Button>
                    ) : null}
                    {current && canUpdate(current, QUOTES_TODAY, group, versions) ? (
                      <Button
                        variant="primary"
                        icon="plus"
                        onClick={() => {
                          setDraft(draftFromVersion(current));
                          setMode("update");
                        }}
                      >
                        更新报价（新版本）
                      </Button>
                    ) : null}
                    {current && canWithdraw(current, QUOTES_TODAY) ? (
                      <Button variant="secondary" onClick={() => setMode("withdraw")}>
                        撤回报价
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {mode === "withdraw" && current ? (
                  <Panel
                    title={`撤回 v${current.version}`}
                    description="撤回后买家看到“报价已撤回”，不可恢复。请填写原因，平台会记录并转达。"
                  >
                    <Field
                      optionalText="（可选）"
                      label="撤回原因"
                      required
                      htmlFor="wd-reason"
                      error={reason ? (withdrawReasonError(reason) ?? undefined) : undefined}
                    >
                      <TextArea
                        id="wd-reason"
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="例如：原材料涨价，无法按原价供货"
                      />
                    </Field>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="danger"
                        disabled={withdrawReasonError(reason) !== null}
                        onClick={() => withdraw(current)}
                      >
                        确认撤回
                      </Button>
                      <Button variant="ghost" onClick={() => setMode("view")}>
                        取消
                      </Button>
                    </div>
                  </Panel>
                ) : null}

                {mode === "cancel" && pending ? (
                  <Panel
                    title={`撤销提交 v${pending.version}`}
                    description="审核中的提交可以撤销；未转达买家。"
                  >
                    <Field
                      optionalText="（可选）"
                      label="原因"
                      required
                      htmlFor="cc-reason"
                      error={reason ? (withdrawReasonError(reason) ?? undefined) : undefined}
                    >
                      <TextInput
                        id="cc-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="例如：价格填错了"
                      />
                    </Field>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={withdrawReasonError(reason) !== null}
                        onClick={() => cancel(pending)}
                      >
                        确认撤销
                      </Button>
                      <Button variant="ghost" onClick={() => setMode("view")}>
                        取消
                      </Button>
                    </div>
                  </Panel>
                ) : null}

                {mode === "update" && current && draft ? (
                  <UpdateForm
                    previous={current}
                    draft={draft}
                    onDraft={setDraft}
                    onSubmit={() => submitNew(current)}
                    onCancel={() => setMode("view")}
                  />
                ) : null}

                <Panel title="版本历史" padded={false}>
                  <ol className="divide-y divide-(--fbg-border-subtle)">
                    {groupVersions.map((v, i) => {
                      const prev = groupVersions[i + 1];
                      const diffs = prev ? diffVersions(prev, v) : [];
                      return (
                        <li key={v.id} className="flex flex-col gap-1.5 px-5 py-3 text-sm">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-(--fbg-text-primary)">
                              v{v.version}
                            </span>
                            <Badge tone={QUOTE_STATUS_TONE[zhStatus(v, QUOTES_TODAY)]} icon={null}>
                              {zhStatus(v, QUOTES_TODAY)}
                            </Badge>
                            {v.isCurrent ? (
                              <Badge tone="ink" icon={null}>
                                买家可见的版本
                              </Badge>
                            ) : null}
                            <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                              提交 {formatZhDate(v.submittedAt)} · 确认{" "}
                              {formatZhDate(v.confirmedAt)} · {validityText(v, QUOTES_TODAY)}
                            </span>
                          </span>
                          {diffs.length > 0 ? (
                            <ul className="text-xs text-(--fbg-text-secondary)">
                              {diffs.map((d) => (
                                <li key={d.field}>
                                  {d.field}：{d.before} → {d.after}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <ul className="fbg-num text-xs text-(--fbg-text-secondary)">
                            {v.events.map((e, j) => (
                              <li key={`${v.id}-${j}`}>{eventTextZh(e)}</li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>
              </>
            ) : (
              <EmptyState
                title="请选择一条报价"
                body="待审核和即将过期的报价排在前面。"
                icon="document"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function VersionPanel({ v, group }: { v: QuoteVersion; group: QuoteGroup }) {
  return (
    <Panel
      title={`v${v.version} 报价内容`}
      description="已提交的内容不可修改；如需变更请提交新版本。"
      padded={false}
    >
      <div className="px-5 py-4">
        <KeyValue
          columns={2}
          items={[
            {
              label: "交易条款",
              value: `${v.basisCode} ${v.basisPlace}（${INCOTERM_GLOSS[v.basisCode]}）`,
            },
            { label: "货币 / 单位", value: `${v.currency} / ${v.unit}` },
            { label: "有效期", value: validityText(v, QUOTES_TODAY) },
            { label: "交期", value: `${v.leadTimeDays} 天` },
            { label: "付款方式", value: v.paymentTerms },
            {
              label: "模具费",
              value: v.toolingIncluded
                ? "已含在单价内"
                : v.toolingAmount === null
                  ? "无"
                  : `${formatZhMoney(v.toolingAmount, v.currency)}（一次性）`,
            },
            { label: "可见范围", value: `${group.visibility}（${group.buyerLabel}）` },
            {
              label: "提交 / 确认",
              value: `${formatZhDate(v.submittedAt)} / ${formatZhDate(v.confirmedAt)}`,
            },
          ]}
        />
        {v.notes ? <p className="mt-3 text-sm text-(--fbg-text-primary)">备注：{v.notes}</p> : null}
      </div>
      <table className="w-full border-t border-(--fbg-border-subtle) text-sm">
        <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
          <tr>
            <th scope="col" className="px-5 py-2 text-left font-medium">
              数量区间（{v.unit}）
            </th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              单价
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--fbg-border-subtle)">
          {v.tiers.map((t) => (
            <tr key={t.id}>
              <td className="fbg-num px-5 py-2 text-(--fbg-text-primary)">{tierRangeZh(t)}</td>
              <td className="fbg-num px-5 py-2 text-right text-(--fbg-text-primary)">
                {t.unitPrice === null ? "—" : formatZhMoney(t.unitPrice, v.currency, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function UpdateForm({
  previous,
  draft,
  onDraft,
  onSubmit,
  onCancel,
}: {
  previous: QuoteVersion;
  draft: VersionDraft;
  onDraft: (d: VersionDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const gate = newVersionGate(draft, previous, QUOTES_TODAY);
  const basisIssue = validateBasis(draft.basisCode, draft.basisPlace);
  const set = (patch: Partial<VersionDraft>) => onDraft({ ...draft, ...patch });
  return (
    <Panel
      title={`更新报价：提交 v${previous.version + 1}`}
      description="以当前版本为基础修改。提交后进入待审核；平台确认后替代当前版本，买家看到新版本。"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field optionalText="（可选）" label="货币" htmlFor="up-currency">
          <Select
            id="up-currency"
            value={draft.currency}
            onChange={(e) => set({ currency: e.target.value === "USD" ? "USD" : "CNY" })}
          >
            <option value="CNY">CNY 人民币</option>
            <option value="USD">USD 美元</option>
          </Select>
        </Field>
        <Field optionalText="（可选）" label="单位" htmlFor="up-unit">
          <TextInput
            id="up-unit"
            value={draft.unit}
            onChange={(e) => set({ unit: e.target.value })}
          />
        </Field>
        <Field
          optionalText="（可选）"
          label="交易条款"
          htmlFor="up-basis"
          hint={INCOTERM_GLOSS[draft.basisCode]}
        >
          <Select
            id="up-basis"
            value={draft.basisCode}
            onChange={(e) => set({ basisCode: e.target.value as IncotermCode })}
          >
            {INCOTERM_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          optionalText="（可选）"
          label="指定地点"
          htmlFor="up-place"
          error={basisIssue?.level === "error" ? basisIssue.message : undefined}
          hint={basisIssue?.level === "warning" ? basisIssue.message : undefined}
        >
          <TextInput
            id="up-place"
            value={draft.basisPlace}
            onChange={(e) => set({ basisPlace: e.target.value })}
          />
        </Field>
        <div className="md:col-span-2">
          <p className="mb-2 text-xs font-semibold text-(--fbg-text-primary)">阶梯价格</p>
          <TierTable
            tiers={draft.tiers}
            onChange={(tiers) => set({ tiers })}
            currency={draft.currency}
            unit={draft.unit}
            idPrefix="up-tier"
          />
        </div>
        <Field optionalText="（可选）" label="模具费（一次性）" htmlFor="up-tooling">
          <TextInput
            id="up-tooling"
            inputMode="decimal"
            value={draft.toolingAmount}
            disabled={draft.toolingIncluded}
            onChange={(e) => set({ toolingAmount: e.target.value })}
          />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            id="up-tooling-inc"
            label="模具费已含在单价内"
            checked={draft.toolingIncluded}
            onChange={(on) => set({ toolingIncluded: on })}
          />
        </div>
        <Field optionalText="（可选）" label="交期（天）" htmlFor="up-lead">
          <TextInput
            id="up-lead"
            inputMode="numeric"
            value={draft.leadTimeDays}
            onChange={(e) => set({ leadTimeDays: e.target.value })}
          />
        </Field>
        <Field optionalText="（可选）" label="付款方式" htmlFor="up-pay">
          <TextInput
            id="up-pay"
            value={draft.paymentTerms}
            onChange={(e) => set({ paymentTerms: e.target.value })}
          />
        </Field>
        <Field
          optionalText="（可选）"
          label="有效期至"
          required
          htmlFor="up-valid"
          hint="必须晚于今天；未注明的报价买家看到“有效期未确认”。"
        >
          <TextInput
            id="up-valid"
            type="date"
            min={QUOTES_TODAY}
            value={draft.validUntil}
            onChange={(e) => set({ validUntil: e.target.value })}
          />
        </Field>
        <Field
          optionalText="（可选）"
          label="更新原因"
          required
          htmlFor="up-reason"
          hint="平台与买家都会看到。"
        >
          <TextInput
            id="up-reason"
            value={draft.changeReason}
            onChange={(e) => set({ changeReason: e.target.value })}
            placeholder="例如：延长有效期；每档下调 0.01 元"
          />
        </Field>
        <Field optionalText="（可选）" label="备注" htmlFor="up-notes" className="md:col-span-2">
          <TextArea
            id="up-notes"
            rows={2}
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
        <div className="md:col-span-2">
          <Checkbox
            id="up-spec"
            label="确认已按买家当前规格版本报价"
            checked={draft.specConfirmed}
            onChange={(on) => set({ specConfirmed: on })}
          />
        </div>
      </div>
      <div className="mt-4 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) p-3 text-xs">
        <p className="font-semibold text-(--fbg-text-primary)">与 v{previous.version} 的差异</p>
        {(() => {
          const diffs = diffVersions(previous, {
            currency: draft.currency,
            unit: draft.unit,
            basisCode: draft.basisCode,
            basisPlace: draft.basisPlace,
            tiers: draft.tiers,
            toolingAmount: draft.toolingIncluded
              ? null
              : draft.toolingAmount.trim()
                ? Number(draft.toolingAmount)
                : null,
            toolingIncluded: draft.toolingIncluded,
            leadTimeDays: Number(draft.leadTimeDays),
            paymentTerms: draft.paymentTerms,
            validUntil: draft.validUntil || null,
          });
          return diffs.length === 0 ? (
            <p className="mt-1 text-(--fbg-text-secondary)">尚无变化。</p>
          ) : (
            <ul className="mt-1 text-(--fbg-text-secondary)">
              {diffs.map((d) => (
                <li key={d.field}>
                  {d.field}：{d.before} → {d.after}
                </li>
              ))}
            </ul>
          );
        })()}
      </div>
      {gate.length > 0 ? (
        <p className="mt-3 text-xs text-(--fbg-status-danger)">提交前请补充：{gate.join("、")}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" icon="check" disabled={gate.length > 0} onClick={onSubmit}>
          提交新版本（待平台审核）
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </Panel>
  );
}
