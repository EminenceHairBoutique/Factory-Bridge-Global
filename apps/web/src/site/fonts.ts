/**
 * Public-site typefaces (Inter for text, Geist for display; Geist only on marketing routes, as H-16 asks).
 *
 * Deviation from handoff H-2 / H-16, recorded for B-05: those specify `next/font/local` with committed font
 * files so builds work offline. This uses `next/font/google`, which downloads the files at BUILD time and then
 * serves them from this origin — visitors make no request to a font CDN and get metric-matched fallbacks (no
 * layout shift) — but `next build` needs network access to fonts.googleapis.com / fonts.gstatic.com and fails
 * without it (CI and Vercel have it). Switching to `next/font/local` later only changes this file. Imported by
 * app/(site)/layout.tsx only. Chinese glosses use the system CJK stack (`.fbg-zh` in design-preview.css).
 */
import { Geist, Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fbg-font-inter",
});

export const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--fbg-font-geist",
});

export const siteFontClasses = `${inter.variable} ${geist.variable}`;
