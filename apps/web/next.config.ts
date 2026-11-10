import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@fbg/domain", "@fbg/i18n", "@fbg/db"],
  headers() {
    return Promise.resolve([
      { source: "/(.*)", headers: securityHeaders },
      // The invite token is in the path (ADR-041 §6): never send it in a Referer header. Last match wins.
      { source: "/invite/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ]);
  },
};

export default nextConfig;
