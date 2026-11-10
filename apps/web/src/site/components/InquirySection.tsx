"use client";

/**
 * Error boundary around the sourcing-request form. If the server action call itself fails (the site was
 * redeployed while the page was open, so the action id no longer exists; or the network dropped), React throws
 * to the nearest boundary. Without one the whole page would fall to the framework error screen and the visitor's
 * draft would be gone. Here the form is replaced by an honest notice and comes back with the draft restored.
 */
import { Component, useState, type ReactNode } from "react";
import type { InquiryMode } from "@/server/inquiry/config";
import { FORM } from "../content";
import { Notice, buttonClasses } from "../design-system";
import type { InquiryValues } from "../inquiry-fields";
import { InquiryForm } from "./InquiryForm";

class Boundary extends Component<
  { children: ReactNode; fallback: (reset: () => void) => ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children;
  }
}

export function InquirySection({ mode }: { mode: InquiryMode }) {
  const [draft, setDraft] = useState<InquiryValues | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  return (
    <Boundary
      key={attempt}
      fallback={() => (
        <div className="rounded-(--fbg-radius-dialog) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-6 sm:p-8">
          <Notice tone="danger" title={FORM.unreachable.title}>
            {FORM.unreachable.body}
          </Notice>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClasses("primary", "md")}
              onClick={() => setAttempt((n) => n + 1)}
            >
              {FORM.unreachable.retry}
            </button>
            <button
              type="button"
              className={buttonClasses("secondary", "md")}
              onClick={() => window.location.reload()}
            >
              {FORM.unreachable.reload}
            </button>
          </div>
        </div>
      )}
    >
      <InquiryForm mode={mode} draft={draft} onDraft={setDraft} />
    </Boundary>
  );
}
