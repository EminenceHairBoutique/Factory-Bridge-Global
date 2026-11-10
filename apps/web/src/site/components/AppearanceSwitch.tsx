"use client";

/**
 * Atlas / Obsidian / System switch for the public site, bound to the shared appearance scope.
 *
 * A group of toggle buttons (aria-pressed), not the design system's radiogroup: a radiogroup promises
 * arrow-key navigation, which the shared SegmentedControl does not implement yet. Same visual treatment.
 */
import { THEME_OPTIONS, cx, useTheme } from "../design-system";

export function AppearanceSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label="Appearance"
      className="inline-flex max-w-full rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-sunken) p-0.5"
    >
      {THEME_OPTIONS.map((opt) => {
        const active = opt.value === theme;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(opt.value)}
            className={cx(
              "h-9 min-w-11 rounded-[7px] px-3 text-sm font-medium whitespace-nowrap",
              active
                ? "bg-(--fbg-bg-inverse) text-(--fbg-text-inverse)"
                : "text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
