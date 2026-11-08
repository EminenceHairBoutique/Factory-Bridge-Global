"use client";

/**
 * 数据共享设置 (IA §2.3 `/supplier/settings/data-sharing`). Simplified-Chinese first. Local state only.
 * Labels declare intent; only recorded grants make data visible (SECURITY_PERMISSION_MATRIX §3). Revocation
 * effects follow §3.4.
 */
import { useState } from "react";
import { SHARING_FIELDS, SHARING_GRANTS, type ZhVisibility } from "../demo-data/supplier";
import { formatZhDate } from "../supplier-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import { Badge, Button, Notice, PageHeader, Panel, cx } from "../ui/primitives";
import { useEscapeKey } from "../ui/useEscapeKey";

const SCOPES: ZhVisibility[] = ["仅内部", "平台买家", "指定买家"];

export function SupplierSharing() {
  const [scopes, setScopes] = useState<Record<string, ZhVisibility>>(() =>
    Object.fromEntries(SHARING_FIELDS.map((f) => [f.key, f.scope])),
  );
  const [grants, setGrants] = useState(SHARING_GRANTS);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEscapeKey(revoking !== null, () => setRevoking(null));

  const dirty = SHARING_FIELDS.some((f) => scopes[f.key] !== f.scope);
  const target = grants.find((g) => g.id === revoking);

  return (
    <AppShell workspace="supplier" title="数据共享设置">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="数据共享设置"
          lead="逐项决定哪些信息可以给谁看。这里的设置表达您的意愿；买家实际能否看到，取决于平台记录的授权。"
        />

        <Notice tone="ink" icon="lock" title="授权如何生效">
          标签本身不授予任何访问权限。只有平台记录的、未过期且未撤销的授权，才会让买家看到对应字段。撤销授权后，目录与价格立即对该买家不可见；您已向该买家发出的报价仍保留在买家的记录中，不会被收回。
        </Notice>

        <Panel title="按字段设置可见范围" padded={false}>
          <ul className="divide-y divide-(--fbg-border-subtle)">
            {SHARING_FIELDS.map((f) => {
              const value = scopes[f.key] ?? f.scope;
              return (
                <li
                  key={f.key}
                  className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-(--fbg-text-primary)">
                      {f.label}
                      {f.locked ? (
                        <Badge tone="brand" icon="lock">
                          需单独披露授权
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-sm text-(--fbg-text-secondary)">{f.description}</p>
                    {f.lockNote ? (
                      <p className="mt-1 text-xs text-(--fbg-text-secondary)">{f.lockNote}</p>
                    ) : null}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`${f.label} 的可见范围`}
                    className="inline-flex shrink-0 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-sunken) p-0.5"
                  >
                    {SCOPES.map((s) => {
                      const active = value === s;
                      const disabled = f.locked && s !== "仅内部";
                      return (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={disabled}
                          title={disabled ? "联系人信息需通过单独的披露授权" : undefined}
                          onClick={() => {
                            setScopes((m) => ({ ...m, [f.key]: s }));
                            setSaved(false);
                          }}
                          className={cx(
                            "h-9 rounded-[7px] px-3 text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40",
                            active
                              ? "bg-(--fbg-bg-inverse) text-(--fbg-text-inverse)"
                              : "text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--fbg-border-subtle) px-5 py-3">
            <p className="text-xs text-(--fbg-text-secondary)">
              选择“指定买家”后，需在对应产品的阶梯报价中指定买家，并由平台记录授权。
            </p>
            <div className="flex items-center gap-2">
              {saved ? <Badge tone="ok">已保存（原型，仅本地）</Badge> : null}
              <Button variant="primary" disabled={!dirty || saved} onClick={() => setSaved(true)}>
                保存设置
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="已记录的授权"
          description="每条授权都有起止日期，并写入审计记录。到期或撤销后立即失效。"
          padded={false}
        >
          <div className="fbg-scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
                <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th scope="col">买家</th>
                  <th scope="col">字段</th>
                  <th scope="col">起始</th>
                  <th scope="col">截止</th>
                  <th scope="col">状态</th>
                  <th scope="col" className="text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--fbg-border-subtle)">
                {grants.map((g) => (
                  <tr key={g.id} className="[&>td]:px-5 [&>td]:py-3">
                    <td className="text-(--fbg-text-primary)">{g.buyer}</td>
                    <td>{g.field}</td>
                    <td className="fbg-num">{formatZhDate(g.since)}</td>
                    <td className="fbg-num">{formatZhDate(g.until)}</td>
                    <td>
                      <Badge tone={g.status === "有效" ? "ok" : "neutral"}>{g.status}</Badge>
                    </td>
                    <td className="text-right">
                      {g.status === "有效" ? (
                        <Button size="sm" variant="danger" onClick={() => setRevoking(g.id)}>
                          撤销授权
                        </Button>
                      ) : (
                        <span className="text-xs text-(--fbg-text-secondary)">
                          已于 2026年11月7日 撤销
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {revoking && target ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="撤销授权"
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          >
            <button
              type="button"
              className="absolute inset-0 bg-(--fbg-overlay)"
              aria-label="关闭"
              onClick={() => setRevoking(null)}
            />
            <div className="fbg-raised relative w-full max-w-lg rounded-t-(--fbg-radius-dialog) p-5 sm:rounded-(--fbg-radius-dialog)">
              <h2 className="text-lg font-semibold text-(--fbg-text-primary)">
                撤销对 {target.buyer} 的“{target.field}”授权？
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-(--fbg-text-secondary)">
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    size={16}
                    className="mt-0.5 shrink-0 text-(--fbg-status-success)"
                  />
                  该买家将立即无法查看您的阶梯价格；相关的搜索与索引记录由平台任务删除。
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="info"
                    size={16}
                    className="mt-0.5 shrink-0 text-(--fbg-status-info)"
                  />
                  您已向该买家发出的报价仍保留在买家的交易记录中。若不希望其用于新的比较，请在“询价单”中撤回对应报价。
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="lock"
                    size={16}
                    className="mt-0.5 shrink-0 text-(--fbg-text-secondary)"
                  />
                  撤销操作将写入审计记录，包含操作人与时间。
                </li>
              </ul>
              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => setRevoking(null)}>取消</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setGrants((list) =>
                      list.map((g) => (g.id === target.id ? { ...g, status: "已撤销" } : g)),
                    );
                    setRevoking(null);
                  }}
                >
                  确认撤销
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
