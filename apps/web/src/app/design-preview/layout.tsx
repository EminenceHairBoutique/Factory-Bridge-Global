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
 * never flashes Atlas and then animates every colour. Reads one localStorage key, validates it, and adds
 * `<meta name="fbg-theme">` to <head>; design-preview.css keys the pre-hydration tokens off that meta with
 * `:has()`, so no React-managed element is touched and hydration stays clean. The script is emitted as raw
 * HTML (not a React <script> element) so it runs at parse time on the server-rendered page and is inert on
 * client navigations, where the theme is already in React state. Design-preview only (404 in production).
 */
const THEME_BOOT =
  '<script>(function(){try{var p=new URLSearchParams(location.search).get("theme");' +
  'var v=(p==="atlas"||p==="obsidian")?p:localStorage.getItem("fbg-design-preview-theme");' +
  'if(v==="atlas"||v==="obsidian"||v==="system"){var m=document.createElement("meta");' +
  'm.name="fbg-theme";m.content=v;document.head.appendChild(m)}}catch(e){}})();</script>';

export default function DesignPreviewLayout({ children }: { children: ReactNode }) {
  if (!isDesignPreviewEnabled(process.env)) notFound();
  return (
    <>
      <span hidden dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
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
