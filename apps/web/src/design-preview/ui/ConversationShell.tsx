"use client";

/**
 * Conversation-first layout for the inboxes (UX-04): a compact thread list, a spacious
 * conversation column with a sticky composer, and the supplier, evidence and approval history in
 * an on-demand drawer opened from the conversation header. Phones show the list, then the
 * conversation with a back control. Shared by the buyer and supplier inboxes.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";
import { buttonClasses, cx } from "./primitives";
import { useEscapeKey } from "./useEscapeKey";

export interface ConversationLabels {
  back: string;
  details: string;
  close: string;
  list: string;
  conversation: string;
}

export function ConversationShell({
  list,
  header,
  strip,
  conversation,
  composer,
  drawer,
  drawerTitle,
  drawerOpen,
  onDrawerOpenChange,
  view,
  onBack,
  labels,
  empty,
}: {
  list: ReactNode;
  header: ReactNode;
  strip?: ReactNode;
  conversation: ReactNode;
  composer?: ReactNode;
  drawer: ReactNode;
  drawerTitle: string;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  view: "list" | "thread";
  onBack: () => void;
  labels: ConversationLabels;
  /** Rendered instead of the conversation when nothing is selected. */
  empty?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEscapeKey(drawerOpen, () => onDrawerOpenChange(false));
  useEffect(() => {
    if (drawerOpen) panelRef.current?.focus();
  }, [drawerOpen]);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]">
      <section
        aria-label={labels.list}
        className={cx("min-w-0", view === "thread" && "hidden lg:block")}
      >
        {list}
      </section>

      <section
        aria-label={labels.conversation}
        className={cx("flex min-w-0 flex-col", view === "list" && "hidden lg:flex")}
      >
        {empty ? (
          empty
        ) : (
          <>
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={onBack}
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) text-(--fbg-text-secondary) lg:hidden"
                aria-label={labels.back}
              >
                <Icon name="chevron-right" size={16} className="rotate-180" />
              </button>
              <div className="min-w-0 flex-1">{header}</div>
              <button
                type="button"
                onClick={() => onDrawerOpenChange(true)}
                aria-expanded={drawerOpen}
                aria-haspopup="dialog"
                className={cx(buttonClasses("secondary", "sm"), "shrink-0")}
              >
                <Icon name="info" size={14} />
                {labels.details}
              </button>
            </div>
            {strip ? <div className="mt-3">{strip}</div> : null}
            <div className="mt-4 flex flex-col gap-3">{conversation}</div>
            {composer ? (
              <div className="sticky bottom-14 z-10 mt-4 -mx-4 border-t border-(--fbg-border-subtle) bg-(--fbg-bg-canvas)/95 px-4 pt-3 pb-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
                {composer}
              </div>
            ) : null}
          </>
        )}
      </section>

      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={drawerTitle}
          className="fixed inset-0 z-50"
        >
          <button
            type="button"
            className="absolute inset-0 bg-(--fbg-overlay)"
            aria-label={labels.close}
            onClick={() => onDrawerOpenChange(false)}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="fbg-raised absolute inset-y-0 right-0 flex w-full max-w-(--fbg-drawer-w) flex-col overflow-y-auto bg-(--fbg-bg-surface) p-5 outline-none"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-(--fbg-text-primary)">{drawerTitle}</p>
              <button
                type="button"
                onClick={() => onDrawerOpenChange(false)}
                aria-label={labels.close}
                className="inline-flex h-8 w-8 items-center justify-center rounded-(--fbg-radius-control) text-(--fbg-text-secondary) hover:bg-(--fbg-hover)"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="mt-4 text-sm">{drawer}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Compact thread row for the list column: a status dot, one line of subject, one line of meta. */
export function ThreadRow({
  active,
  unread,
  dotClass,
  subject,
  meta,
  statusLabel,
  time,
  onSelect,
}: {
  active: boolean;
  unread?: boolean;
  dotClass: string;
  subject: string;
  meta: string;
  statusLabel: string;
  time: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-current={active ? "true" : undefined}
      className={cx(
        "flex w-full min-w-0 flex-col gap-0.5 px-3 py-2 text-left hover:bg-(--fbg-bg-canvas)",
        active && "bg-(--fbg-selected)",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={cx("h-2 w-2 shrink-0 rounded-full", dotClass)} aria-hidden />
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-[13px] text-(--fbg-text-primary)",
            unread ? "font-semibold" : "font-medium",
          )}
        >
          {subject}
        </span>
        <span className="fbg-num shrink-0 text-[11px] text-(--fbg-text-secondary)">{time}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1 pl-4 text-[11px] text-(--fbg-text-secondary)">
        <span className="min-w-0 truncate">{meta}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{statusLabel}</span>
      </span>
    </button>
  );
}

export const DOT_CLASS: Record<"warn" | "teal" | "ok" | "neutral", string> = {
  warn: "bg-(--fbg-status-warning)",
  teal: "bg-(--fbg-action-primary)",
  ok: "bg-(--fbg-status-success)",
  neutral: "bg-(--fbg-border-strong)",
};
