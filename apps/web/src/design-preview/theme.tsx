"use client";

/**
 * Appearance (theme) scope for the design preview: Atlas (light), Obsidian (dark) or System.
 * The choice is a per-viewer convenience stored in localStorage; every read/write is guarded because storage
 * may be unavailable (private windows, blocked site data). The first render always uses Atlas so server and
 * client markup match; the stored choice is applied after mount. `?theme=atlas|obsidian` forces one page load
 * for design-review links and screenshots without touching the stored choice.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { parseThemeParam } from "./theme-param";

export type ThemeChoice = "atlas" | "obsidian" | "system";

const STORAGE_KEY = "fbg-design-preview-theme";

interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (next: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "atlas",
  setTheme: () => undefined,
});

function readStored(): ThemeChoice | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "atlas" || v === "obsidian" || v === "system" ? v : null;
  } catch {
    return null;
  }
}

export function ThemeScope({
  children,
  className,
  initial,
}: {
  children: ReactNode;
  className?: string | undefined;
  /** Force a theme (used by the gallery's side-by-side panels and the marketing hero). */
  initial?: ThemeChoice | undefined;
}) {
  const [theme, setThemeState] = useState<ThemeChoice>(initial ?? "atlas");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (initial) return;
    const forced = parseThemeParam(window.location.search);
    if (forced) {
      setThemeState(forced);
      return;
    }
    const stored = readStored();
    if (stored) setThemeState(stored);
  }, [initial]);

  const setTheme = (next: ThemeChoice) => {
    setThemeState(next);
    // Keep the pre-hydration attribute in step so the next page load paints the chosen theme at once.
    document.documentElement.setAttribute("data-fbg-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: keep in-memory choice */
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        className={["fbg-dp min-w-0", hydrated && "fbg-hydrated", className]
          .filter(Boolean)
          .join(" ")}
        data-theme={theme}
        data-theme-fixed={initial ? "" : undefined}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: "atlas", label: "Atlas" },
  { value: "obsidian", label: "Obsidian" },
  { value: "system", label: "System" },
];
