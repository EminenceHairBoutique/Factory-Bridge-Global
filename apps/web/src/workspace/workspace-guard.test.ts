/**
 * Static guards for B-05 (ADR-042 §4). Layouts are not re-run on client navigations, so the authorization gate must
 * be called by every page and every server action itself. These tests fail when a workspace page or action is added
 * without it, when a page gates on the wrong workspace, or when the session proxy starts matching the public site.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { config as proxyConfig } from "../proxy";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const APP = join(SRC, "app");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const rel = (p: string) => relative(SRC, p).replaceAll("\\", "/");
const code = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const WORKSPACES = { app: "buyer", ops: "internal", supplier: "supplier" } as const;

describe("every workspace page gates on its own workspace", () => {
  for (const [segment, kind] of Object.entries(WORKSPACES)) {
    const pages = files(join(APP, segment)).filter((p) => /[\\/]page\.tsx$/.test(p));
    it(`/${segment}: ${pages.length} page(s) call requireWorkspace("${kind}", …)`, () => {
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) {
        const src = code(p);
        expect(src, rel(p)).toMatch(new RegExp(`requireWorkspace\\(\\s*"${kind}"`));
        for (const other of Object.values(WORKSPACES).filter((k) => k !== kind)) {
          expect(src, `${rel(p)} must not gate on ${other}`).not.toMatch(
            new RegExp(`requireWorkspace\\(\\s*"${other}"`),
          );
        }
      }
    });
  }
});

describe("every server action re-checks the session", () => {
  const actionModules = files(APP)
    .concat(files(join(SRC, "server", "auth")))
    .filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\./.test(p))
    .filter((p) => /^\s*["']use server["']/.test(readFileSync(p, "utf8")));

  it("finds the action modules", () => {
    expect(actionModules.map(rel)).toEqual(
      expect.arrayContaining([
        "app/(auth)/actions.ts",
        "app/onboarding/actions.ts",
        "app/invite/[token]/actions.ts",
        "app/app/actions.ts",
        "app/app/settings/team/actions.ts",
        "server/auth/switch-org.ts",
      ]),
    );
  });

  it("each exported action in a workspace / onboarding / invite module calls the guard", () => {
    // (auth) actions establish the session and (site) is the public, unauthenticated inquiry form (B-31).
    const gated = actionModules.filter(
      (m) => !rel(m).startsWith("app/(auth)/") && !rel(m).startsWith("app/(site)/"),
    );
    expect(gated.length).toBeGreaterThanOrEqual(5);
    for (const p of gated) {
      const src = code(p);
      const bodies = src.split(/export async function /).slice(1);
      expect(bodies.length, rel(p)).toBeGreaterThan(0);
      for (const body of bodies) {
        const name = body.slice(0, body.indexOf("("));
        expect(body, `${rel(p)} → ${name}`).toMatch(/require(Workspace|SignedIn)\(/);
      }
    }
  });

  it("workspace action modules gate on the matching workspace", () => {
    for (const p of actionModules) {
      const r = rel(p);
      if (r.startsWith("app/app/"))
        expect(code(p), r).not.toMatch(/requireWorkspace\(\s*"(internal|supplier)"/);
      if (r.startsWith("app/ops/"))
        expect(code(p), r).not.toMatch(/requireWorkspace\(\s*"(buyer|supplier)"/);
      if (r.startsWith("app/supplier/"))
        expect(code(p), r).not.toMatch(/requireWorkspace\(\s*"(buyer|internal)"/);
    }
  });
});

describe("session proxy scope", () => {
  it("matches only auth and workspace paths — never the public site or /design-preview", () => {
    const matchers = proxyConfig.matcher;
    expect(matchers).toEqual(
      expect.arrayContaining(["/app/:path*", "/ops/:path*", "/supplier/:path*", "/sign-in/:path*"]),
    );
    for (const m of matchers) {
      expect(m, m).not.toMatch(/^\/(:path\*|\(.*\))?$/);
      expect(m, m).not.toMatch(/design-preview|^\/api/);
    }
  });
});
