"use client";

/**
 * 供应商工作台：批量导入 (IA `/supplier/catalog/import`). Download the template, load a CSV
 * (file, pasted text or a sample), preview every product with its row-numbered errors, warnings
 * and the diff against the current catalog, then import the clean rows. Imported prices land as
 * 待确认 and never reach a buyer until confirmed in 阶梯报价. CSV is parsed here for the preview;
 * the real pipeline parses CSV and XLSX server-side in isolation. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { SUPPLIER_PRODUCTS, type SupplierProduct } from "../demo-data/supplier";
import {
  CATALOG_TODAY,
  FIXTURE_ERRORS_CSV,
  FIXTURE_VALID_CSV,
  TEMPLATE_COLUMNS,
  TEMPLATE_VERSION,
} from "../demo-data/supplier-import";
import { validateUploads } from "../documents-demo";
import {
  applyImport,
  buildImportPreview,
  importSummary,
  templateCsv,
  type ImportEntry,
  type ImportStatus,
} from "../supplier-catalog-demo";
import { UPLOAD_REASON_ZH } from "../supplier-messages-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  TextArea,
  cx,
  type Tone,
} from "../ui/primitives";

const STATUS_TONE: Record<ImportStatus, Tone> = {
  新增: "teal",
  更新: "warn",
  未变化: "neutral",
  错误: "danger",
};

export function SupplierCatalogImport() {
  const [products, setProducts] = useState<SupplierProduct[]>(SUPPLIER_PRODUCTS);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [applied, setApplied] = useState<Array<{
    id: string;
    nameZh: string;
    isNew: boolean;
  }> | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const preview = useMemo(
    () => (csvText === null ? null : buildImportPreview(csvText, products, CATALOG_TODAY)),
    [csvText, products],
  );
  const summary = preview ? importSummary(preview.entries) : null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const load = (text: string, label: string) => {
    setCsvText(text);
    setSource(label);
    setApplied(null);
    setFileNote(null);
    note(`已载入 ${label}`);
  };

  const downloadTemplate = () => {
    const blob = new Blob([String.fromCharCode(0xfeff) + templateCsv()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "factory-bridge-产品目录模板.csv";
    a.click();
    URL.revokeObjectURL(url);
    note(`已下载模板（${TEMPLATE_VERSION}，UTF-8 含 BOM）`);
  };

  const onFiles = async (files: File[]) => {
    const result = validateUploads(files);
    if (result.rejected.length > 0) {
      setFileNote(
        result.rejected
          .map((r) => `${r.name}：${UPLOAD_REASON_ZH[r.reason] ?? r.reason}`)
          .join("；"),
      );
      return;
    }
    const f = files[0];
    if (!f) return;
    if (f.type === "text/csv" || f.name.toLowerCase().endsWith(".csv")) {
      load(await f.text(), f.name);
    } else {
      setFileNote(
        `${f.name}：XLSX 由平台服务器解析后预览（此设计预览仅解析 CSV）。请改用 CSV 模板，或载入示例文件查看预览效果。`,
      );
    }
  };

  const doImport = () => {
    if (!preview) return;
    const { products: next, imported } = applyImport(products, preview.entries);
    setProducts(next);
    setApplied(imported);
    setCsvText(null);
    setSource(null);
    note(`已导入 ${imported.length} 个产品，均为待确认`);
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">依据</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">导入规则</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>按“产品名称（中文）”匹配现有产品：相同则更新，不同则新增。</li>
        <li>同一产品的每档价格各占一行；产品信息在各行必须一致。</li>
        <li>有错误的产品不会导入；其余产品可导入，预览会逐一列出变更。</li>
        <li>导入的价格一律为“待确认”，买家看不到，直到您在阶梯报价中确认有效。</li>
        <li>交易条款必须是正式代码并附指定地点；“出厂价”等口语会被拒绝，不会按 EXW 处理。</li>
        <li>文件先经平台扫描；XLSX 中的公式不会执行，只读取已计算的值。</li>
        <li>每次导入记录在审计日志：文件、行数、导入人与时间。</li>
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
    <AppShell workspace="supplier" title="批量导入" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="批量导入"
          lead="用模板一次导入多个产品及其阶梯价格。导入前逐行预览错误与变更；导入后所有价格为待确认，买家看不到，直到您确认有效。"
          meta={
            <>
              <Badge tone="neutral" icon={null} className="fbg-num">
                模板 {TEMPLATE_VERSION}
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                当前 {products.length} 个产品
              </Badge>
            </>
          }
          actions={
            <Link href="/design-preview/supplier/catalog" className={buttonClasses("secondary")}>
              返回产品目录
            </Link>
          }
        />

        {/* 1 模板 */}
        <Panel
          title="1. 下载模板"
          description="CSV，UTF-8 含 BOM，Excel 可直接打开。一行一档价格；产品信息在各行重复填写。"
          actions={
            <Button size="sm" icon="download" onClick={downloadTemplate}>
              下载模板
            </Button>
          }
        >
          <div className="fbg-scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead>
                <tr className="border-b border-(--fbg-border-subtle) text-(--fbg-text-secondary)">
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    列
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    必填
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    说明
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    示例
                  </th>
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_COLUMNS.map((c) => (
                  <tr
                    key={c.key}
                    className="border-b border-(--fbg-border-subtle) align-top last:border-0"
                  >
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap text-(--fbg-text-primary)">
                      {c.header}
                    </td>
                    <td className="px-2 py-1.5 text-(--fbg-text-secondary)">
                      {c.required ? "是" : "否"}
                    </td>
                    <td className="px-2 py-1.5 text-(--fbg-text-secondary)">{c.hint}</td>
                    <td className="fbg-num px-2 py-1.5 text-(--fbg-text-secondary)">{c.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* 2 上传 */}
        <Panel
          title="2. 上传文件"
          description="CSV 或 XLSX，25 MB 以内。文件先经平台扫描；本预览在浏览器内解析 CSV，不上传任何内容。"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="catalog-file"
                className={cx(buttonClasses("primary", "md"), "cursor-pointer")}
              >
                <Icon name="upload" size={16} /> 选择文件
              </label>
              <input
                id="catalog-file"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  void onFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <Button size="md" onClick={() => load(FIXTURE_VALID_CSV, "示例文件：可导入")}>
                载入示例（可导入）
              </Button>
              <Button size="md" onClick={() => load(FIXTURE_ERRORS_CSV, "示例文件：含错误")}>
                载入示例（含错误）
              </Button>
            </div>
            {fileNote ? (
              <Notice tone="warn" title="未载入">
                {fileNote}
              </Notice>
            ) : null}
            <details className="text-sm">
              <summary className="cursor-pointer text-(--fbg-text-secondary)">
                或粘贴 CSV 内容
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <TextArea
                  aria-label="粘贴 CSV 内容"
                  rows={4}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="包含模板表头的 CSV 文本"
                />
                <div>
                  <Button
                    size="sm"
                    disabled={pasted.trim().length === 0}
                    onClick={() => load(pasted, "粘贴的 CSV")}
                  >
                    载入粘贴内容
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </Panel>

        {/* 3 预览 */}
        <Panel
          title="3. 预览与检查"
          description={
            source ? `来源：${source}` : "载入文件后，这里逐个产品列出状态、错误与变更。"
          }
          padded={false}
        >
          {!preview ? (
            <div className="p-6">
              <EmptyState
                title="尚未载入文件"
                body="上传 CSV，或载入示例文件查看预览。"
                icon="upload"
              />
            </div>
          ) : preview.fileErrors.length > 0 ? (
            <div className="p-5">
              <Notice tone="danger" title="文件无法预览">
                {preview.fileErrors.join(" ")}
              </Notice>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-(--fbg-border-subtle) p-4">
                {summary ? (
                  <>
                    <Badge tone="teal" icon={null} className="fbg-num">
                      新增 {summary.新增}
                    </Badge>
                    <Badge tone="warn" icon={null} className="fbg-num">
                      更新 {summary.更新}
                    </Badge>
                    <Badge tone="neutral" icon={null} className="fbg-num">
                      未变化 {summary.未变化}
                    </Badge>
                    <Badge
                      tone={summary.错误 > 0 ? "danger" : "neutral"}
                      icon={summary.错误 > 0 ? "alert" : null}
                      className="fbg-num"
                    >
                      错误 {summary.错误}
                    </Badge>
                    <span className="text-xs text-(--fbg-text-secondary)">
                      有错误的产品不会导入。
                    </span>
                  </>
                ) : null}
              </div>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {preview.entries.map((e) => (
                  <EntryRow key={e.key} e={e} />
                ))}
              </ul>
            </>
          )}
        </Panel>

        {/* 4 导入 */}
        <Panel title="4. 导入">
          {applied ? (
            <Notice tone="ok" title={`已导入 ${applied.length} 个产品，均为待确认`}>
              <ul className="mt-1 flex flex-col gap-1">
                {applied.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {p.nameZh}
                      <span className="text-xs text-(--fbg-text-secondary)">
                        （{p.isNew ? "新增" : "更新"}）
                      </span>
                    </span>
                    {p.isNew ? (
                      <span className="text-xs text-(--fbg-text-secondary)">
                        新产品：预览中不进入阶梯报价编辑器
                      </span>
                    ) : (
                      <Link
                        href={`/design-preview/supplier/pricing?product=${p.id}`}
                        className="text-xs font-medium text-(--fbg-text-link) hover:underline"
                      >
                        去阶梯报价确认有效
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2">买家看不到这些价格，直到您逐一确认有效。导入已记录在审计日志。</p>
            </Notice>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-(--fbg-text-secondary)">
                {summary
                  ? summary.importable > 0
                    ? `将导入 ${summary.importable} 个产品（新增 ${summary.新增}，更新 ${summary.更新}）；${summary.错误} 个有错误的产品会被跳过。`
                    : "没有可导入的产品。请修正错误后重新载入文件。"
                  : "载入并检查文件后，在这里确认导入。"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  icon="check"
                  disabled={!summary || summary.importable === 0}
                  onClick={doImport}
                >
                  确认导入{summary && summary.importable > 0 ? ` ${summary.importable} 个产品` : ""}
                </Button>
                <span className="text-xs text-(--fbg-text-secondary)">
                  导入后价格为待确认；本预览仅在本页模拟。
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function EntryRow({ e }: { e: ImportEntry }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[e.status]} icon={e.status === "错误" ? "alert" : null}>
          {e.status}
        </Badge>
        <span className="text-sm font-medium text-(--fbg-text-primary)">
          {e.key.startsWith("__row_") ? "（无产品名称）" : e.key}
        </span>
        <span className="fbg-num text-xs text-(--fbg-text-secondary)">
          第 {e.rows.join("、")} 行 · {e.rows.length} 档
        </span>
      </div>
      {e.errors.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-(--fbg-status-danger)">
          {e.errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      {e.warnings.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-(--fbg-status-warning)">
          {e.warnings.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      {e.status === "更新" ? (
        <ul className="fbg-num flex flex-col gap-0.5 text-xs text-(--fbg-text-secondary)">
          {e.diffs.map((d) => (
            <li key={d.field}>
              {d.field}：<span className="line-through">{d.before}</span> →{" "}
              <span className="text-(--fbg-text-primary)">{d.after}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {e.status === "新增" && e.draft ? (
        <p className="fbg-num text-xs text-(--fbg-text-secondary)">
          {e.draft.basis.code} {e.draft.basis.place} · {e.draft.currency} / {e.draft.unit} ·{" "}
          {e.draft.tiers.length} 档 · 有效期至 {e.draft.validUntil ?? "未注明"} ·{" "}
          {e.draft.visibility}
        </p>
      ) : null}
      {e.status === "未变化" ? (
        <p className="text-xs text-(--fbg-text-secondary)">与目录中的记录完全一致，跳过。</p>
      ) : null}
    </li>
  );
}
