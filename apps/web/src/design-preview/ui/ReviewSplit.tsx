"use client";

/**
 * ReviewSplit (IA §3): the source-document pane and the extracted-fields pane, with anchors that
 * highlight the line a value came from. Shared by the operator review (editable, accept gate lives
 * in the screen) and the buyer review (read-only, fewer controls). The document pane is a synthetic
 * rendering of addressable lines, not a PDF viewer (B-12 will supply page/bbox anchors).
 */
import { useEffect, type ReactNode } from "react";
import type { Confidence, ExtractedField } from "../demo-data";
import type { DocLine } from "../demo-data/documents";
import { Icon } from "./icons";
import { Badge, Panel, Select, TextInput, cx } from "./primitives";

export type ReviewPane = "document" | "fields";

const CONFIDENCE_LABEL: Record<Confidence, string> = { high: "High", medium: "Medium", low: "Low" };
const CONFIDENCE_SEGMENTS: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

/** Three-segment band plus text; never a percentage. */
export function ConfidenceBand({ level }: { level: Confidence }) {
  const n = CONFIDENCE_SEGMENTS[level];
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Extraction confidence: ${CONFIDENCE_LABEL[level]}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx(
              "h-2 w-3 rounded-sm",
              i <= n
                ? level === "low"
                  ? "bg-(--fbg-status-warning)"
                  : level === "medium"
                    ? "bg-(--fbg-text-secondary)"
                    : "bg-(--fbg-action-primary)"
                : "bg-(--fbg-border-subtle)",
            )}
          />
        ))}
      </span>
      <span className="text-[11px] text-(--fbg-text-secondary)">{CONFIDENCE_LABEL[level]}</span>
    </span>
  );
}

/** Phone and tablet switch between the two panes; both show side by side from lg. */
export function PaneToggle({
  pane,
  onChange,
}: {
  pane: ReviewPane;
  onChange: (p: ReviewPane) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Pane"
      className="inline-flex rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-0.5 lg:hidden"
    >
      {(["document", "fields"] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={pane === p}
          onClick={() => onChange(p)}
          className={cx(
            "h-8 rounded px-3 text-sm font-medium",
            pane === p
              ? "bg-(--fbg-action-primary) text-(--fbg-action-on-primary)"
              : "text-(--fbg-text-secondary)",
          )}
        >
          {p === "document" ? "Document" : "Fields"}
        </button>
      ))}
    </div>
  );
}

const BASIS_OPTIONS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DPU", "DDP"];

export interface ReviewSplitProps {
  lines: DocLine[];
  pages: number[];
  fields: ExtractedField[];
  activeAnchor: string | null;
  onAnchor: (anchor: string) => void;
  pane: ReviewPane;
  documentDescription?: string | undefined;
  fieldsDescription?: string | undefined;
  /** Buyers see values as text; operators get inputs. */
  readOnly?: boolean | undefined;
  /** Live edit while typing (operator). */
  onFieldInput?: ((key: string, value: string | null) => void) | undefined;
  /** Committed edit (blur or select change) that should record a correction. */
  onFieldCommit?: ((key: string, value: string) => void) | undefined;
  /** Extra content under a field, e.g. a buyer's flag control. */
  renderFieldExtra?: ((field: ExtractedField) => ReactNode) | undefined;
}

export function ReviewSplit({
  lines,
  pages,
  fields,
  activeAnchor,
  onAnchor,
  pane,
  documentDescription = "Synthetic rendering. Click an anchor in the field list to highlight its line.",
  fieldsDescription = "Unknown values are null and labelled “Not in document”, never a default.",
  readOnly = false,
  onFieldInput,
  onFieldCommit,
  renderFieldExtra,
}: ReviewSplitProps) {
  useEffect(() => {
    if (!activeAnchor) return;
    document.getElementById(`anchor-${activeAnchor}`)?.scrollIntoView({ block: "center" });
  }, [activeAnchor, pane]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel
        title="Source document"
        description={documentDescription}
        padded={false}
        className={cx(pane !== "document" && "hidden lg:block")}
      >
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {pages.map((page) => (
            <div
              key={page}
              className="mb-4 rounded border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-4"
            >
              <p className="fbg-num mb-2 text-[11px] text-(--fbg-text-secondary)">Page {page}</p>
              <ol className="flex flex-col gap-1">
                {lines
                  .filter((l) => l.page === page)
                  .map((l) => {
                    const active = l.id === activeAnchor;
                    return (
                      <li
                        key={l.id}
                        id={`anchor-${l.id}`}
                        className={cx(
                          "rounded px-2 py-1 text-sm break-words",
                          l.table ? "fbg-num font-mono text-xs" : "",
                          l.zh ? "fbg-zh" : "",
                          active
                            ? "bg-(--fbg-brand-accent)/15 ring-1 ring-(--fbg-brand-accent)"
                            : "text-(--fbg-text-primary)",
                        )}
                        lang={l.zh ? "zh-CN" : undefined}
                      >
                        {l.text}
                      </li>
                    );
                  })}
              </ol>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title={readOnly ? "Extracted values" : "Extracted fields"}
        description={fieldsDescription}
        padded={false}
        className={cx(pane !== "fields" && "hidden lg:block")}
      >
        <ul className="divide-y divide-(--fbg-border-subtle)">
          {fields.map((f) => {
            const labelId = `f_${f.key}`;
            return (
              <li key={f.key} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  {readOnly ? (
                    <span id={labelId} className="text-sm font-medium text-(--fbg-text-primary)">
                      {f.label}
                    </span>
                  ) : (
                    <label
                      htmlFor={labelId}
                      className="text-sm font-medium text-(--fbg-text-primary)"
                    >
                      {f.label}
                    </label>
                  )}
                  <ConfidenceBand level={f.confidence} />
                </div>

                {readOnly ? (
                  <p
                    className={cx(
                      "text-sm",
                      f.key.startsWith("tier") && "fbg-num",
                      f.value === null
                        ? "text-(--fbg-text-secondary) italic"
                        : "text-(--fbg-text-primary)",
                    )}
                    aria-labelledby={labelId}
                  >
                    {f.value ??
                      (f.key === "priceBasis" ? "Unknown — not stated" : "Not in document")}
                  </p>
                ) : f.key === "priceBasis" ? (
                  <Select
                    id={labelId}
                    value={f.value ?? ""}
                    onChange={(e) => onFieldCommit?.(f.key, e.target.value)}
                    aria-describedby={f.flag ? `flag_${f.key}` : undefined}
                  >
                    <option value="">Not confirmed</option>
                    <option value="unknown">unknown — request confirmation</option>
                    {BASIS_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <TextInput
                    id={labelId}
                    value={f.value ?? ""}
                    placeholder={f.value === null ? "Not in document" : undefined}
                    onChange={(e) =>
                      onFieldInput?.(f.key, e.target.value === "" ? null : e.target.value)
                    }
                    onBlur={(e) => {
                      if (e.target.value !== (f.value ?? ""))
                        onFieldCommit?.(f.key, e.target.value);
                    }}
                    aria-describedby={f.flag ? `flag_${f.key}` : undefined}
                    className={cx(f.key.startsWith("tier") && "fbg-num")}
                  />
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {f.anchor ? (
                    <button
                      type="button"
                      onClick={() => onAnchor(f.anchor as string)}
                      className={cx(
                        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium",
                        activeAnchor === f.anchor
                          ? "border-(--fbg-brand-accent) bg-(--fbg-brand-accent)/10 text-(--fbg-brand-accent)"
                          : "border-(--fbg-border-subtle) text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
                      )}
                      aria-pressed={activeAnchor === f.anchor}
                    >
                      <Icon name="eye" size={12} /> {f.anchor}
                    </button>
                  ) : (
                    <Badge tone="neutral" icon="info">
                      Not in document
                    </Badge>
                  )}
                  {f.flag ? (
                    <span
                      id={`flag_${f.key}`}
                      className="flex items-start gap-1 text-(--fbg-status-warning)"
                    >
                      <Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {f.flag}
                    </span>
                  ) : null}
                </div>
                {renderFieldExtra ? renderFieldExtra(f) : null}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
