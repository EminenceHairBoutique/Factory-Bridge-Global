"use client";

/**
 * 供应商工作台 (IA §2.3 `/supplier`). Simplified-Chinese first. Local state only; 演示数据。
 */
import Link from "next/link";
import { useState } from "react";
import { SUPPLIER_PROFILE, SUPPLIER_PRODUCTS, SUPPLIER_RFQS } from "../demo-data/supplier";
import { daysUntil, formatZhDate, formatZhMoney, tierRangeZh } from "../supplier-demo";
import { SUPPLIER_THREADS } from "../demo-data/supplier-messages";
import { smSummary } from "../supplier-messages-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  cx,
  Notice,
  PageHeader,
  Panel,
  type Tone,
} from "../ui/primitives";

const TODAY = "2026-11-07";

const RFQ_TONE: Record<string, Tone> = {
  待回复: "warn",
  需要澄清: "warn",
  已报价: "teal",
  已拒绝: "neutral",
};

const PRICE_TONE: Record<string, Tone> = {
  已确认: "ok",
  待确认: "warn",
  有效期未确认: "warn",
  即将过期: "warn",
  已过期: "danger",
  已暂停: "neutral",
};

const VERIFY_TONE: Record<string, Tone> = { 已核验: "ok", 待审核: "neutral", 需补充: "warn" };

const PENDING_MESSAGES = smSummary(SUPPLIER_THREADS).pendingReply;

export function SupplierDashboard() {
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const pendingRfqs = SUPPLIER_RFQS.filter((r) => r.status === "待回复" || r.status === "需要澄清");
  const pendingPrices = SUPPLIER_PRODUCTS.filter(
    (p) => (p.status === "待确认" || p.validUntil === null) && !confirmed.has(p.id),
  );
  const expiring = SUPPLIER_PRODUCTS.filter((p) => {
    const d = daysUntil(p.validUntil, TODAY);
    return d !== null && d <= 14 && !confirmed.has(p.id);
  });

  return (
    <AppShell workspace="supplier" title="工作台">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="工作台"
          lead="您的询价、价格确认与企业认证，在这里集中处理。未经您确认，平台不会向买家展示任何价格。"
          meta={
            <>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                截至 {formatZhDate(TODAY)}
              </Badge>
              <Badge tone="neutral" icon="building">
                {SUPPLIER_PROFILE.nameZh} · {SUPPLIER_PROFILE.city}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/design-preview/supplier/catalog" className={buttonClasses("secondary")}>
                产品目录
              </Link>
              <Link href="/design-preview/supplier/pricing" className={buttonClasses("primary")}>
                <Icon name="plus" size={16} />
                新增阶梯报价
              </Link>
            </div>
          }
        />

        {PENDING_MESSAGES > 0 ? (
          <Notice
            tone="warn"
            icon="message"
            title={`${PENDING_MESSAGES} 条买家消息待回复`}
            action={
              <Link
                href="/design-preview/supplier/messages"
                className={buttonClasses("secondary", "sm")}
              >
                查看消息
              </Link>
            }
          >
            买家的澄清问题由平台翻译并转达；您的回复经平台运营核对后转达买家。
          </Notice>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          {/* 待处理询价 */}
          <Panel
            className="xl:col-span-2"
            title="待处理询价"
            description="买家的询价由平台转达。您的回复经平台审核后转达买家；平台不会代您报价。"
            padded={false}
            actions={
              <Link
                href="/design-preview/supplier/rfqs"
                className="text-sm font-medium text-(--fbg-link) hover:underline"
              >
                查看全部询价单
              </Link>
            }
          >
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {pendingRfqs.map((r) => {
                const left = daysUntil(r.replyBy, TODAY) ?? 0;
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-(--fbg-text-primary)">
                        {r.productZh}
                        <Badge tone={RFQ_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                      </p>
                      <p className="fbg-num mt-0.5 text-sm text-(--fbg-text-secondary)">
                        {r.ref} · {r.buyerLabel} ·{" "}
                        {new Intl.NumberFormat("zh-CN").format(r.quantity)} {r.unit} · 目的地{" "}
                        {r.destination}
                      </p>
                      <p
                        className={cx(
                          "fbg-num mt-0.5 text-xs",
                          left <= 3 ? "text-(--fbg-status-danger)" : "text-(--fbg-text-secondary)",
                        )}
                      >
                        回复截止 {formatZhDate(r.replyBy)}（剩余 {left} 天）
                      </p>
                    </div>
                    <Link
                      href={`/design-preview/supplier/rfqs?rfq=${r.id}`}
                      className={buttonClasses("secondary", "sm")}
                    >
                      {r.status === "需要澄清" ? "回复澄清" : "查看并报价"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* 企业认证状态 */}
          <Panel
            title="企业认证状态"
            description="认证由平台运营人员审核；上传的文件在审核前标注为“供应商提供，未核验”。"
          >
            <div className="mb-3 flex items-center gap-2">
              <Badge
                tone={VERIFY_TONE[SUPPLIER_PROFILE.verification.overall] ?? "neutral"}
                icon="shield"
              >
                总体状态：{SUPPLIER_PROFILE.verification.overall}
              </Badge>
            </div>
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {SUPPLIER_PROFILE.verification.items.map((item) => (
                <li key={item.label} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-(--fbg-text-primary)">{item.label}</p>
                    {"date" in item && item.date ? (
                      <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                        {item.status === "已核验" ? "核验日期" : "提交日期"}{" "}
                        {formatZhDate(item.date)}
                      </p>
                    ) : null}
                    {"note" in item && item.note ? (
                      <p className="mt-0.5 text-xs text-(--fbg-status-warning)">{item.note}</p>
                    ) : null}
                  </div>
                  <Badge tone={VERIFY_TONE[item.status] ?? "neutral"} className="shrink-0">
                    {item.status}
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/design-preview/supplier/documents?upload=premises"
                className={cx(buttonClasses("primary"), "w-full")}
              >
                <Icon name="upload" size={16} />
                上传生产场地证明
              </Link>
              <Link
                href="/design-preview/supplier/documents"
                className={cx(buttonClasses("ghost", "sm"), "w-full")}
              >
                文件资料
              </Link>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {/* 待确认价格 */}
          <Panel
            title="待确认价格"
            description="交易条款或有效期未注明的价格不会向买家展示，也无法进入比较。"
            padded={false}
          >
            {pendingPrices.length === 0 ? (
              <p className="px-5 py-6 text-sm text-(--fbg-text-secondary)">暂无待确认价格。</p>
            ) : (
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {pendingPrices.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-medium text-(--fbg-text-primary)">
                        {p.nameZh}
                      </p>
                      <Badge tone={PRICE_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                      {p.validUntil === null ? <Badge tone="warn">有效期未确认</Badge> : null}
                    </div>
                    <ul className="flex flex-col gap-0.5 text-sm text-(--fbg-text-secondary)">
                      {p.basis.code === "unknown" ? (
                        <li className="flex items-start gap-1 text-(--fbg-status-warning)">
                          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                          交易条款记录为“未注明”（原始报价单写的是“{p.basis.colloquial}
                          ”）。请选择正式条款并填写指定地点。
                        </li>
                      ) : null}
                      {p.validUntil === null ? (
                        <li className="flex items-start gap-1 text-(--fbg-status-warning)">
                          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                          未注明有效期。平台不会视为长期有效，请填写具体日期。
                        </li>
                      ) : null}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/design-preview/supplier/pricing?product=${p.id}`}
                        className={buttonClasses("primary", "sm")}
                      >
                        补充并确认
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* 即将过期报价 */}
          <Panel
            title="即将过期报价"
            description="到期后价格将标注为“报价已过期”，并从买家的比较中移除。"
            padded={false}
          >
            {expiring.length === 0 ? (
              <p className="px-5 py-6 text-sm text-(--fbg-text-secondary)">
                14 天内没有即将过期的报价。
              </p>
            ) : (
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {expiring.map((p) => {
                  const left = daysUntil(p.validUntil, TODAY) ?? 0;
                  const first = p.tiers[0];
                  return (
                    <li key={p.id} className="flex flex-col gap-2 px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-medium text-(--fbg-text-primary)">
                          {p.nameZh}
                        </p>
                        <Badge tone={left < 0 ? "danger" : "warn"} icon="clock" className="fbg-num">
                          {left < 0
                            ? `报价已过期 ${formatZhDate(p.validUntil)}`
                            : `有效期至 ${formatZhDate(p.validUntil)}（剩余 ${left} 天）`}
                        </Badge>
                      </div>
                      {first && first.minQty !== null && first.unitPrice !== null ? (
                        <p className="fbg-num text-sm text-(--fbg-text-secondary)">
                          {p.basis.code} {p.basis.place} · 首档 {tierRangeZh(first)} {p.unit} ·{" "}
                          {formatZhMoney(first.unitPrice, p.currency, 4)}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          icon="check"
                          onClick={() => setConfirmed((s) => new Set(s).add(p.id))}
                        >
                          确认有效（延长 90 天）
                        </Button>
                        <Link
                          href={`/design-preview/supplier/pricing?product=${p.id}`}
                          className={buttonClasses("secondary", "sm")}
                        >
                          更新报价
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {confirmed.size > 0 ? (
              <p className="border-t border-(--fbg-border-subtle) px-5 py-2.5 text-xs text-(--fbg-text-secondary)">
                已确认 {confirmed.size}{" "}
                项（原型：仅本地记录；正式系统中会生成新的报价版本并写入审计记录）。
              </p>
            ) : null}
          </Panel>
        </div>

        <Panel title="最近动态" description="来自审计记录。">
          <ol className="flex flex-col gap-2 text-sm">
            {[
              { when: "2026-11-06", what: "收到新询价 RFQ-DEMO-2026-031（BOPP 卷筒不干胶标签）" },
              {
                when: "2026-11-05",
                what: "平台运营就 RFQ-DEMO-2026-027 发起澄清：交易条款与刀模费",
              },
              {
                when: "2026-11-04",
                what: "BOPP 卷筒不干胶标签 阶梯报价已确认，有效期至 2026年12月15日",
              },
              { when: "2026-11-03", what: "牛皮纸套报价已提交，待平台审核" },
              { when: "2026-10-31", what: "PE 自封袋报价已过期" },
            ].map((e) => (
              <li key={e.what} className="flex items-start justify-between gap-3">
                <span className="text-(--fbg-text-primary)">{e.what}</span>
                <span className="fbg-num shrink-0 text-xs text-(--fbg-text-secondary)">
                  {formatZhDate(e.when)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </AppShell>
  );
}
