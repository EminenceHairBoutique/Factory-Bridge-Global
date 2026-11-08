import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isDesignPreviewEnabled } from "@/design-preview/gate";
import "@/design-preview/design-preview.css";

/**
 * Design-preview segment (track UX-01). Synthetic data only.
 * Production isolation: `isDesignPreviewEnabled` returns false for production builds unless a non-production
 * host opts in explicitly, in which case the whole segment 404s. The pages are also marked noindex.
 */
export const metadata: Metadata = {
  title: "Design preview — Factory Bridge Global (demo data)",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * Applies the stored appearance (or `?theme=atlas|obsidian`) before the first paint so a dark preference
 * never flashes Atlas and then animates every colour. Reads one localStorage key, validates it, sets one
 * attribute; design-preview only (this segment 404s in production). See design-preview.css "Obsidian".
 */
const THEME_BOOT =
  '(function(){try{var p=new URLSearchParams(location.search).get("theme");' +
  'var v=(p==="atlas"||p==="obsidian")?p:localStorage.getItem("fbg-design-preview-theme");' +
  'if(v==="atlas"||v==="obsidian"||v==="system"){document.documentElement.setAttribute("data-fbg-theme",v)}}catch(e){}})();';

export default function DesignPreviewLayout({ children }: { children: ReactNode }) {
  if (!isDesignPreviewEnabled(process.env)) notFound();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      {/* Geist (display), Inter (app), Noto Sans SC (zh-CN). Loaded at runtime so builds stay offline-safe. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
      />
      {children}
    </>
  );
}
