/**
 * Static guards for the production workspace and auth code (B-05): it reuses the design system through one seam but
 * never the preview's synthetic data, shell or routes; it never touches the service-role client; client components
 * read no environment; and its copy passes the same public-claims guard as the marketing site.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { enUS, zhCN } from "@fbg/i18n";
import { findProhibitedClaims } from "@/site/claims";
import { AUTH_COPY, BUYER_COPY, INVITE_COPY, ONBOARDING_COPY, OPS_COPY } from "./copy";

const SRC = fileURLToPath(new URL("..", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const PRODUCTION = [
  ...files(join(SRC, "workspace")),
  ...files(join(SRC, "server", "auth")),
  ...files(join(SRC, "server", "buyer")),
  ...files(join(SRC, "app", "(auth)")),
  ...files(join(SRC, "app", "app")),
  ...files(join(SRC, "app", "ops")),
  ...files(join(SRC, "app", "supplier")),
  ...files(join(SRC, "app", "onboarding")),
  ...files(join(SRC, "app", "invite")),
  join(SRC, "proxy.ts"),
].filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p));

const read = (p: string) => readFileSync(p, "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const rel = (p: string) => relative(SRC, p).replaceAll("\\", "/");

describe("workspace isolation", () => {
  it("covers the production files", () => {
    expect(PRODUCTION.map(rel)).toEqual(
      expect.arrayContaining([
        "workspace/ui.ts",
        "workspace/WorkspaceShell.tsx",
        "server/auth/guard.ts",
        "app/(auth)/sign-in/page.tsx",
        "app/app/page.tsx",
        "app/ops/page.tsx",
        "app/supplier/page.tsx",
        "proxy.ts",
      ]),
    );
  });

  it("imports the design system only through workspace/ui.ts (plus its token CSS)", () => {
    for (const p of PRODUCTION) {
      const imports = [...read(p).matchAll(/from\s+"([^"]+)"|import\s+"([^"]+)"/g)].map(
        (m) => m[1] ?? m[2] ?? "",
      );
      for (const spec of imports.filter((s) => s.includes("design-preview"))) {
        const allowed =
          (rel(p) === "workspace/ui.ts" &&
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
      expect(src, rel(p)).not.toMatch(/demo-data|ui\/AppShell|ui\/AuthFrame|DemoStripe|\/nav["']/);
    }
  });

  it("never imports the service-role client, and client components read no environment", () => {
    for (const p of PRODUCTION) {
      const src = read(p);
      expect(src, rel(p)).not.toMatch(
        /@fbg\/db\/service-role|SERVICE_ROLE|createServiceRoleClient/,
      );
      if (/^"use client"/.test(src)) {
        expect(src, rel(p)).not.toMatch(/process\.env|createServerClient|@supabase\//);
      }
      expect(src, rel(p)).not.toMatch(/console\.log/);
    }
  });

  it("never logs a token, password or code", () => {
    for (const p of PRODUCTION) {
      for (const m of code(p).matchAll(/console\.(error|warn)\(([^;]*)\)/g)) {
        // error.code (a Postgres/PostgREST code such as 42501) is fine; values the user typed are not
        expect(m[2]!.replace(/error\.code|briefError\.code/g, ""), rel(p)).not.toMatch(
          /token|password|\bcode\b|email|otp/i,
        );
      }
    }
  });
});

describe("workspace copy", () => {
  it("passes the public-claims guard (EN copy and the new supplier / role strings in both locales)", () => {
    // The guard was written for marketing claims; its "no invented savings" rule also matches the button verb "Save",
    // which is removed (button labels only) so every other rule still applies to the rest of the copy.
    const english = [AUTH_COPY, BUYER_COPY, INVITE_COPY, ONBOARDING_COPY, OPS_COPY]
      .flatMap((c) => Object.values(c))
      .map((s) => s.replace(/^Save (brief|changes)$/, ""))
      .join(" ¶ ");
    expect(findProhibitedClaims(english)).toEqual([]);
    const keys = Object.keys(enUS).filter((k) => /^(supplier|nav|role)\./.test(k)) as Array<
      keyof typeof enUS
    >;
    expect(keys.length).toBeGreaterThan(5);
    expect(findProhibitedClaims(keys.map((k) => enUS[k]).join(" ¶ "))).toEqual([]);
    for (const k of keys) expect(zhCN[k].trim().length, k).toBeGreaterThan(0);
  });
});
