"use client";

/**
 * 供应商工作台：文件资料 (IA `/supplier/documents`). Every file the supplier uploaded or the platform
 * attached, with its pipeline status, its review state (供应商提供，未核验 until a platform check),
 * expiry, what it is linked to and who can see it; the certification checklist; upload, replace as
 * a new version, delete where allowed, and a signed download link that is logged. Uploads are
 * simulated locally: nothing leaves the browser. Local state only.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SD_CATEGORIES,
  SD_SHARE_EXPLANATION,
  SUPPLIER_DOCS_TODAY,
  SUPPLIER_DOCUMENTS,
  type SdCategory,
  type SupplierDocument,
} from "../demo-data/supplier-documents";
import type { DocumentStatus } from "@fbg/domain";
import { formatBytes, validateUploads } from "../documents-demo";
import {
  SD_STATUS_TONE,
  canDelete,
  canDownload,
  canReplace,
  certificateChecklist,
  documentsSummary,
  expiryState,
  nextStatusFor,
  replaceDocument,
  reviewLabel,
  sortDocuments,
  statusLabel,
} from "../supplier-documents-demo";
import { formatZhDate } from "../supplier-demo";
import { UPLOAD_REASON_ZH } from "../supplier-messages-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  Select,
  Tabs,
  cx,
} from "../ui/primitives";
import { useEscapeKey } from "../ui/useEscapeKey";

type Filter = "全部" | SdCategory;
const SIMULATED_STEP_MS = 1400;

const CHECK_TONE = {
  已拒绝: "danger",
  待上传: "warn",
  扫描中: "teal",
  待平台审核: "warn",
  已核验: "ok",
} as const;

function now(): string {
  return `${SUPPLIER_DOCS_TODAY} ${new Date().toISOString().slice(11, 16)}`;
}

export function SupplierDocuments({
  initialDocId,
  initialUploadKey,
}: {
  initialDocId?: string | undefined;
  initialUploadKey?: string | undefined;
}) {
  const [docs, setDocs] = useState<SupplierDocument[]>(SUPPLIER_DOCUMENTS);
  const [filter, setFilter] = useState<Filter>("全部");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDocId && SUPPLIER_DOCUMENTS.some((d) => d.id === initialDocId)
      ? initialDocId
      : "sd_premises_rejected",
  );
  const [uploadCategory, setUploadCategory] = useState<SdCategory>("企业资质");
  const [uploadKey, setUploadKey] = useState<string>(initialUploadKey ?? "premises");
  const [fileError, setFileError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const timers = useRef<Set<number>>(new Set());

  useEscapeKey(deleting !== null, () => setDeleting(null));
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);
  useEffect(() => {
    if (initialUploadKey) fileInput.current?.scrollIntoView({ block: "center" });
  }, [initialUploadKey]);

  const summary = useMemo(() => documentsSummary(docs, SUPPLIER_DOCS_TODAY), [docs]);
  const checklist = useMemo(() => certificateChecklist(docs), [docs]);
  const rows = useMemo(
    () =>
      sortDocuments(docs).filter(
        (d) => d.status !== "discarded" && (filter === "全部" || d.category === filter),
      ),
    [docs, filter],
  );
  const countFor = (f: Filter) =>
    docs.filter((d) => d.status !== "discarded" && (f === "全部" || d.category === f)).length;
  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const schedule = (id: string, status: DocumentStatus, category: SdCategory) => {
    const next = nextStatusFor(status, category);
    if (!next) return;
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: next } : d)));
      schedule(id, next, category);
    }, SIMULATED_STEP_MS);
    timers.current.add(t);
  };

  const addFiles = (files: File[]) => {
    const result = validateUploads(files);
    setFileError(
      result.rejected.length
        ? result.rejected
            .map((r) => `${r.name}：${UPLOAD_REASON_ZH[r.reason] ?? r.reason}`)
            .join("；")
        : null,
    );
    if (result.accepted.length === 0) return;
    const at = now();
    const keyType = checklist.find((c) => c.key === uploadKey);
    const created = result.accepted.map<SupplierDocument>((f, i) => ({
      id: `sd_new_${Date.now()}_${i}`,
      name: f.name,
      category: uploadCategory,
      mime: f.type,
      bytes: f.size,
      version: 1,
      uploadedAt: at,
      uploadedBy: "我方",
      status: "uploaded",
      scanReason: null,
      review: { state: "未核验", by: null, at: null, note: null, checkRef: null },
      expiresAt: null,
      linked:
        uploadCategory === "企业资质" && keyType
          ? { kind: "认证项", label: keyType.label, href: "/design-preview/supplier/onboarding" }
          : null,
      requiredKey: uploadCategory === "企业资质" ? uploadKey : null,
      sharedWith: uploadCategory === "报价与询价" ? "已授权买家" : "仅平台",
      access: [],
      supersedes: null,
    }));
    setDocs((prev) => [...created, ...prev]);
    setSelectedId(created[0]?.id ?? null);
    created.forEach((d) => {
      note(`已添加 ${d.name}（${d.category}）— 模拟扫描开始`);
      schedule(d.id, d.status, d.category);
    });
  };

  const replace = (doc: SupplierDocument, files: File[]) => {
    const result = validateUploads(files);
    if (result.rejected.length > 0) {
      setFileError(
        result.rejected
          .map((r) => `${r.name}：${UPLOAD_REASON_ZH[r.reason] ?? r.reason}`)
          .join("；"),
      );
      return;
    }
    const f = result.accepted[0];
    if (!f) return;
    const { docs: next, created } = replaceDocument(docs, doc.id, f, now());
    setDocs(next);
    if (created) {
      setSelectedId(created.id);
      note(`已用 ${created.name} 替换 ${doc.name}（v${created.version}）；旧版本已作废`);
      schedule(created.id, created.status, created.category);
    }
  };

  const issueLink = (doc: SupplierDocument) => {
    const at = now();
    setDocs((prev) =>
      prev.map((d) =>
        d.id === doc.id
          ? { ...d, access: [...d.access, { action: "签名链接", who: "我方", at }] }
          : d,
      ),
    );
    note(`已生成 ${doc.name} 的下载链接，15 分钟内有效；已记录`);
  };

  const confirmDelete = () => {
    const doc = docs.find((d) => d.id === deleting);
    if (!doc) return;
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    if (selectedId === doc.id) setSelectedId(null);
    setDeleting(null);
    note(`已删除 ${doc.name}${doc.status === "in_review" ? "；平台审核已撤回" : ""}`);
  };

  const pickForChecklist = (key: string) => {
    setUploadCategory("企业资质");
    setUploadKey(key);
    fileInput.current?.scrollIntoView({ block: "center" });
    fileInput.current?.focus();
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">依据</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">文件记录</p>
      </div>
      {selected ? (
        <DocumentFacts
          doc={selected}
          onDownload={() => issueLink(selected)}
          onDelete={() => setDeleting(selected.id)}
          onReplace={(files) => replace(selected, files)}
        />
      ) : (
        <p className="text-(--fbg-text-secondary)">请选择一个文件。</p>
      )}
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">本次操作记录</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            暂无。上传、替换、删除与下载链接均记录在审计日志中。
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
    <AppShell workspace="supplier" title="文件资料" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="文件资料"
          lead="您上传或平台附加的所有文件，以及每个文件的审核状态与可见范围。上传的文件在平台核验前一律标注为“供应商提供，未核验”；买家只能看到您授权范围内的文件。"
          meta={
            <>
              <Badge tone="neutral" icon={null} className="fbg-num">
                {summary.total} 个文件
              </Badge>
              <Badge
                tone={summary.needsAction > 0 ? "warn" : "ok"}
                icon={summary.needsAction > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.needsAction} 项需补充
              </Badge>
              <Badge tone="teal" icon={null} className="fbg-num">
                {summary.inReview} 待平台审核
              </Badge>
              <Badge
                tone={summary.expiring > 0 ? "warn" : "neutral"}
                icon={null}
                className="fbg-num"
              >
                {summary.expiring} 即将到期
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                截至 {formatZhDate(SUPPLIER_DOCS_TODAY)}
              </Badge>
            </>
          }
        />

        {/* 认证清单 */}
        <Panel
          title="认证清单"
          description="企业认证所需的文件及其审核状态。核验由平台运营完成；通过后买家会看到“企业身份已核验（日期）”。"
          padded={false}
          actions={
            <Link
              href="/design-preview/supplier/onboarding"
              className={buttonClasses("ghost", "sm")}
            >
              企业资料
            </Link>
          }
        >
          <ul className="divide-y divide-(--fbg-border-subtle)">
            {checklist.map((c) => (
              <li
                key={c.key}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone={CHECK_TONE[c.state]} icon={null}>
                    {c.state}
                  </Badge>
                  <span className="text-sm text-(--fbg-text-primary)">{c.label}</span>
                  <Badge tone={c.required ? "ink" : "neutral"} icon={null}>
                    {c.required ? "必需" : "可选"}
                  </Badge>
                  {c.document ? (
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.document?.id ?? null)}
                      className="fbg-num text-xs text-(--fbg-text-link) hover:underline"
                    >
                      {c.document.name}
                    </button>
                  ) : null}
                </div>
                {c.state === "待上传" || c.state === "已拒绝" ? (
                  <Button
                    size="sm"
                    variant="primary"
                    icon="upload"
                    onClick={() => pickForChecklist(c.key)}
                  >
                    {c.state === "已拒绝" ? "重新上传" : "上传"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>

        {/* 上传 */}
        <Panel
          title="上传文件"
          description="PDF、XLSX、CSV、PNG、JPG、WebP，单个 25 MB 以内。文件先进入隔离区并完成安全扫描；压缩包、SVG 与旧版 Office 格式不接受。"
        >
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
            <Select
              aria-label="文件类别"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as SdCategory)}
            >
              {SD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            {uploadCategory === "企业资质" ? (
              <Select
                aria-label="认证项"
                value={uploadKey}
                onChange={(e) => setUploadKey(e.target.value)}
              >
                {checklist.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="self-center text-xs text-(--fbg-text-secondary)">
                {uploadCategory === "报价与询价"
                  ? "报价文件作为依据保存；价格请通过“提交报价”填写。"
                  : uploadCategory === "产品资料"
                    ? "规格书与导入文件随产品的可见范围展示。"
                    : "样品照片与检验报告在平台核验后进入买家的核验记录。"}
              </p>
            )}
            <div className="flex min-w-0 flex-col items-start gap-2 rounded-(--fbg-radius-control) border border-dashed border-(--fbg-border-strong)/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-(--fbg-text-secondary)">
                拖入文件，或{" "}
                <label
                  htmlFor="sd-upload"
                  className="cursor-pointer font-medium text-(--fbg-text-link) underline-offset-2 hover:underline"
                >
                  选择文件
                </label>
                。
              </p>
              <input
                ref={fileInput}
                id="sd-upload"
                type="file"
                multiple
                accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                className="sr-only"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                icon="upload"
                onClick={() =>
                  addFiles([
                    { name: "厂房照片-门头.jpg", type: "image/jpeg", size: 2_400_000 } as File,
                  ])
                }
              >
                试用示例文件
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-(--fbg-text-secondary)">
            本预览仅在浏览器内模拟扫描与审核流转；不上传任何内容。
          </p>
          {fileError ? (
            <div className="mt-3">
              <Notice tone="danger" title="文件未添加">
                {fileError}
              </Notice>
            </div>
          ) : null}
        </Panel>

        <Tabs
          label="文件类别"
          value={filter}
          onChange={setFilter}
          tabs={(["全部", ...SD_CATEGORIES] as Filter[]).map((f) => ({
            value: f,
            label: f,
            count: countFor(f),
          }))}
        />

        <Panel padded={false}>
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="此类别暂无文件" body="上传文件后会显示在这里。" icon="document" />
            </div>
          ) : (
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {rows.map((d) => {
                const active = d.id === selectedId;
                const expiry = expiryState(d.expiresAt, SUPPLIER_DOCS_TODAY);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      aria-pressed={active}
                      className={cx(
                        "flex w-full min-w-0 flex-col gap-1 px-4 py-3 text-left hover:bg-(--fbg-bg-canvas)",
                        active && "bg-(--fbg-selected)",
                      )}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <Icon
                          name="document"
                          size={16}
                          className="shrink-0 text-(--fbg-text-secondary)"
                        />
                        <span className="fbg-num min-w-0 text-sm font-medium break-all text-(--fbg-text-primary)">
                          {d.name}
                        </span>
                        {d.version > 1 ? (
                          <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                            v{d.version}
                          </span>
                        ) : null}
                        <Badge tone={SD_STATUS_TONE[d.status]} icon={null}>
                          {statusLabel(d)}
                        </Badge>
                        <Badge
                          tone={
                            d.review.state === "已核验"
                              ? "ok"
                              : d.status === "rejected"
                                ? "danger"
                                : "neutral"
                          }
                          icon={null}
                        >
                          {reviewLabel(d)}
                        </Badge>
                        {expiry.state === "即将到期" || expiry.state === "已到期" ? (
                          <Badge tone="warn" icon="alert">
                            {expiry.state}
                            {expiry.days !== null
                              ? `（${expiry.days < 0 ? -expiry.days : expiry.days} 天）`
                              : ""}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                        {d.category} · {formatBytes(d.bytes)} · {d.uploadedBy} · {d.uploadedAt} ·{" "}
                        {d.sharedWith}
                      </span>
                      <span
                        className={cx(
                          "text-xs",
                          d.status === "rejected"
                            ? "text-(--fbg-status-danger)"
                            : "text-(--fbg-text-secondary)",
                        )}
                      >
                        {d.status === "rejected" && d.scanReason
                          ? d.scanReason
                          : d.linked
                            ? `${d.linked.kind}：${d.linked.label}`
                            : "未关联记录"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="xl:hidden">
          {selected ? (
            <Panel title="文件记录">
              <DocumentFacts
                doc={selected}
                onDownload={() => issueLink(selected)}
                onDelete={() => setDeleting(selected.id)}
                onReplace={(files) => replace(selected, files)}
              />
            </Panel>
          ) : null}
        </div>

        {deleting ? (
          <DeleteDialog
            doc={docs.find((d) => d.id === deleting) ?? null}
            onCancel={() => setDeleting(null)}
            onConfirm={confirmDelete}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function DocumentFacts({
  doc,
  onDownload,
  onDelete,
  onReplace,
}: {
  doc: SupplierDocument;
  onDownload: () => void;
  onDelete: () => void;
  onReplace: (files: File[]) => void;
}) {
  const expiry = expiryState(doc.expiresAt, SUPPLIER_DOCS_TODAY);
  const del = canDelete(doc);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="min-w-0">
        <p className="fbg-num text-[15px] font-semibold break-all text-(--fbg-text-primary)">
          {doc.name}
        </p>
        <p className="text-xs text-(--fbg-text-secondary)">
          {doc.category} · v{doc.version}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={SD_STATUS_TONE[doc.status]} icon={null}>
            {statusLabel(doc)}
          </Badge>
          <Badge
            tone={
              doc.review.state === "已核验"
                ? "ok"
                : doc.status === "rejected"
                  ? "danger"
                  : "neutral"
            }
            icon={null}
          >
            {reviewLabel(doc)}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canDownload(doc) ? (
          <Button size="sm" icon="download" onClick={onDownload}>
            下载链接
          </Button>
        ) : null}
        {canReplace(doc) ? (
          <label className={cx(buttonClasses("secondary", "sm"), "cursor-pointer")}>
            <Icon name="upload" size={14} /> 替换
            <input
              type="file"
              accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={(e) => {
                onReplace(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
        {del.ok ? (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            删除
          </Button>
        ) : null}
      </div>
      {!del.ok && del.reason ? (
        <p className="text-xs text-(--fbg-text-secondary)">{del.reason}</p>
      ) : null}

      {doc.status === "rejected" && doc.scanReason ? (
        <Notice tone="danger" title="安全扫描未通过">
          {doc.scanReason}
        </Notice>
      ) : null}

      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">审核状态</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          {doc.review.state === "已核验"
            ? `${doc.review.by} 于 ${doc.review.at ? formatZhDate(doc.review.at) : ""} 核验${doc.review.checkRef ? `，核验项 ${doc.review.checkRef}` : ""}。`
            : doc.status === "in_review"
              ? "平台运营审核中。审核通过后，买家会看到相应的核验记录。"
              : doc.status === "rejected"
                ? "未进入审核。"
                : "尚未提交平台审核；买家看到的仍是“供应商提供，未核验”。"}
        </p>
        {doc.review.note ? (
          <p className="mt-1 text-xs text-(--fbg-text-primary)">{doc.review.note}</p>
        ) : null}
      </div>

      <KeyValue
        columns={1}
        items={[
          {
            label: "有效期",
            value:
              expiry.state === "未注明"
                ? "未注明"
                : `${doc.expiresAt ? formatZhDate(doc.expiresAt) : ""} · ${expiry.state}${expiry.days !== null && expiry.state !== "有效" ? `（${expiry.days < 0 ? `已过 ${-expiry.days}` : `剩余 ${expiry.days}`} 天）` : ""}`,
          },
          {
            label: "可见范围",
            value: (
              <span>
                {doc.sharedWith}
                <span className="block text-xs text-(--fbg-text-secondary)">
                  {SD_SHARE_EXPLANATION[doc.sharedWith]}
                </span>
                {doc.category === "企业资质" && doc.requiredKey === "certs" ? (
                  <Link
                    href="/design-preview/supplier/sharing"
                    className="mt-1 inline-block text-xs font-medium text-(--fbg-text-link) hover:underline"
                  >
                    数据共享设置
                  </Link>
                ) : null}
              </span>
            ),
          },
          {
            label: "关联记录",
            value: doc.linked ? (
              doc.linked.href ? (
                <Link href={doc.linked.href} className="text-(--fbg-text-link) hover:underline">
                  {doc.linked.kind}：{doc.linked.label}
                </Link>
              ) : (
                `${doc.linked.kind}：${doc.linked.label}`
              )
            ) : (
              "未关联"
            ),
          },
          {
            label: "文件",
            value: (
              <span className="fbg-num">
                {doc.mime.split("/").pop()} · {formatBytes(doc.bytes)} · {doc.uploadedBy} ·{" "}
                {doc.uploadedAt}
              </span>
            ),
          },
          {
            label: "版本",
            value: doc.supersedes
              ? `v${doc.version}，替换了上一版本（已作废，保留记录）`
              : `v${doc.version}`,
          },
          {
            label: "保留",
            value:
              doc.review.state === "已核验"
                ? "作为认证或报价依据长期保留；替换后旧版本仍保留记录。"
                : doc.status === "rejected"
                  ? "隔离区保留 7 天后删除。"
                  : "账号有效期内保留。",
          },
        ]}
      />

      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">访问记录</p>
        {doc.access.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">尚无访问记录。</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {doc.access.map((a, i) => (
              <li key={`${a.at}-${i}`} className="fbg-num text-xs text-(--fbg-text-secondary)">
                {a.action} · {a.who} · {a.at}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          每次查看、下载与签名链接都会记录；链接 15 分钟后失效。
        </p>
      </div>
    </div>
  );
}

function DeleteDialog({
  doc,
  onCancel,
  onConfirm,
}: {
  doc: SupplierDocument | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!doc) return null;
  const decision = canDelete(doc);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`删除 ${doc.name}`}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        className="absolute inset-0 bg-(--fbg-overlay)"
        aria-label="关闭"
        onClick={onCancel}
      />
      <div className="fbg-raised relative w-full max-w-lg rounded-t-(--fbg-radius-dialog) p-5 sm:rounded-(--fbg-radius-dialog)">
        <h2 className="fbg-num text-[15px] font-semibold break-all text-(--fbg-text-primary)">
          删除 {doc.name}？
        </h2>
        <p className="mt-1 text-sm text-(--fbg-text-secondary)">
          文件记录将从列表移除；审计日志保留此次操作。
        </p>
        {decision.reason ? (
          <p className="mt-2 text-sm text-(--fbg-text-secondary)">{decision.reason}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onCancel}>取消</Button>
          <Button variant="danger" onClick={onConfirm}>
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}
