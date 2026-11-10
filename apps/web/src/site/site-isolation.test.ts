/**
 * Static guards for the production public site (B-31): it reuses the design system but never the preview's
 * synthetic data, routes or shell, and the inquiry path never exposes or logs secrets.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const PRODUCTION = [
  ...files(join(SRC, "site")),
  ...files(join(SRC, "server", "inquiry")),
  ...files(join(SRC, "app", "(site)")),
  join(SRC, "app", "not-found.tsx"),
  join(SRC, "app", "robots.ts"),
].filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p));

const read = (p: string) => readFileSync(p, "utf8");
/** Source without comments, so documentation that names what is avoided does not trip the guards. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const rel = (p: string) => relative(SRC, p).replaceAll("\\", "/");

describe("public site isolation", () => {
  it("covers the production files", () => {
    expect(PRODUCTION.map(rel)).toEqual(
      expect.arrayContaining([
        "app/(site)/page.tsx",
        "app/(site)/layout.tsx",
        "app/(site)/actions.ts",
        "site/components/SiteHome.tsx",
        "server/inquiry/handle.ts",
      ]),
    );
  });

  it("imports the design system only through site/design-system.ts (plus its token CSS)", () => {
    for (const p of PRODUCTION) {
      const imports = [...read(p).matchAll(/from\s+"([^"]+)"|import\s+"([^"]+)"/g)].map(
        (m) => m[1] ?? m[2] ?? "",
      );
      for (const spec of imports.filter((s) => s.includes("design-preview"))) {
        const allowed =
          (rel(p) === "site/design-system.ts" &&
            /^@\/design-preview\/(ui\/primitives|ui\/icons|theme)$/.test(spec)) ||
          spec === "@/design-preview/design-preview.css";
        expect(allowed, `${rel(p)} imports ${spec}`).toBe(true);
      }
    }
  });

  it("never references preview routes, demo data or the preview shell", () => {
    for (const p of PRODUCTION) {
      const src = code(p);
      expect(src, rel(p)).not.toMatch(/["'`]\/design-preview/);
      expect(src, rel(p)).not.toMatch(/demo-data|ui\/AppShell|DemoStripe|\/nav["']/);
    }
  });

  it("keeps the delivery secrets server-side", () => {
    for (const p of PRODUCTION) {
      const src = read(p);
      expect(src, rel(p)).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(RESEND|INQUIRY|EMAIL)/);
      if (/^"use client"/.test(src)) {
        expect(src, rel(p)).not.toMatch(/process\.env|RESEND_API_KEY|resolveInquiryConfig/);
      }
      expect(src, rel(p)).not.toMatch(/console\.log/);
    }
  });

  it("client components import server modules only as types (zod and the schema stay off the browser)", () => {
    for (const p of PRODUCTION.filter((f) => /^"use client"/.test(read(f)))) {
      const src = read(p);
      for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)";/gms)) {
        const spec = m[2] ?? "";
        if (!/(^@\/server\/|\/server\/)/.test(spec)) continue;
        expect(m[1], `${rel(p)} imports ${spec} as a value`).toBe("type ");
      }
    }
  });

  it("the site's pre-hydration script uses the same appearance key as the shared theme scope", async () => {
    const { THEME_STORAGE_KEY } = await import("./theme-boot");
    const theme = read(join(SRC, "design-preview", "theme.tsx"));
    expect(theme).toContain(`const STORAGE_KEY = "${THEME_STORAGE_KEY}";`);
  });

  it("the preview gate is still enforced by the preview layout", () => {
    const layout = read(join(SRC, "app", "design-preview", "layout.tsx"));
    expect(layout).toMatch(/if \(!isDesignPreviewEnabled\(process\.env\)\) notFound\(\);/);
  });
});
