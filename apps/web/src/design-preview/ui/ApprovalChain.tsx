"use client";

/**
 * The approval chain of one outbound message: You → Operator → Sent via <channel>. Exactly one
 * step waits at a time; a returned step sends the draft back to the buyer. Shared by the inbox,
 * the project Messages tab and any screen that shows a draft.
 */
import type { ChainStep } from "../messages-demo";
import { Icon, type IconName } from "./icons";
import { cx } from "./primitives";

const STEP_CLASS: Record<ChainStep["state"], string> = {
  done: "border-(--fbg-status-success)/35 bg-(--fbg-status-success-fill) text-(--fbg-status-success)",
  waiting:
    "border-(--fbg-status-warning)/40 bg-(--fbg-status-warning-fill) text-(--fbg-status-warning)",
  returned:
    "border-(--fbg-status-danger)/40 bg-(--fbg-status-danger-fill) text-(--fbg-status-danger)",
  pending: "border-(--fbg-border-subtle) text-(--fbg-text-secondary)",
};

const STEP_ICON: Record<ChainStep["state"], IconName> = {
  done: "check",
  waiting: "clock",
  returned: "alert",
  pending: "lock",
};

export function ApprovalChainChips({ steps }: { steps: ChainStep[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Approval chain">
      {steps.map((s, i) => (
        <li key={s.who} className="flex items-center gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-(--fbg-radius-chip) border px-2 py-0.5",
              STEP_CLASS[s.state],
            )}
            title={s.note ?? undefined}
          >
            <Icon name={STEP_ICON[s.state]} size={12} />
            {s.who}
            {s.at ? <span className="fbg-num"> {s.at}</span> : null}
          </span>
          {i < steps.length - 1 ? (
            <Icon name="chevron-right" size={12} className="text-(--fbg-text-muted)" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
