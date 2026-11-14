import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/design-preview/design-preview.css";

/**
 * Auth segment (B-05): sign-in, email code, sign-up. Route group `(auth)` so the marketing fonts and site chrome stay
 * on `(site)`. Never indexed. The Atlas × Obsidian tokens come from the design system's CSS (no preview modules).
 */
export const metadata: Metadata = {
  title: "Sign in — Factory Bridge Global",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
