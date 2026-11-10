import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/design-preview/design-preview.css";

/**
 * Workspace segment (B-05). Loads the Atlas × Obsidian token CSS only. Authorization is NOT done here: layouts are
 * not re-run on client navigations, so every page and server action under this segment calls requireWorkspace()
 * itself (asserted by workspace-guard.test.ts). Never indexed.
 */
export const metadata: Metadata = {
  title: "Factory Bridge Global",
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return children;
}
