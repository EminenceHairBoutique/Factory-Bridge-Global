import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Factory Bridge Global",
  description:
    "Sourcing and procurement workspace for U.S. businesses working with Chinese manufacturers: structured briefs, authorized quotes, like-for-like comparison, transparent landed-cost estimates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
