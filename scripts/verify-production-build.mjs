#!/usr/bin/env node
// Production build gate (M0-D). Run AFTER `pnpm --filter @fbg/web build`.
//
// Starts the built web app with `next start` (NODE_ENV=production) under several runtime environments and
// checks over real HTTP that:
//   1. the public site (B-31) and the liveness route render, and the site stays out of search engines (noindex +
//      robots disallow) because no scenario here opts in with APP_ENV=production + SITE_INDEXING=enabled;
//   2. every probed /design-preview route answers 404 — with no APP_ENV, with DESIGN_PREVIEW=enabled alone,
//      and with APP_ENV=production + DESIGN_PREVIEW=enabled (gate.ts: a production build can never enable
//      the prototypes for production or an unset APP_ENV) — and the 404 body carries no prototype content;
//   3. a positive control: APP_ENV=staging + DESIGN_PREVIEW=enabled DOES serve the prototypes, proving the
//      404s above come from the gate and not from a route that is simply missing.
//
// Exit code 0 only when every expectation holds. No network access beyond 127.0.0.1; no secrets read.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps", "web");
// Next's own CLI entry (its package.json "bin", resolved from apps/web), run with this Node binary. Spawning
// node_modules/.bin/next instead fails on Windows (a shell shim; the .cmd needs a shell), and through a shim kill()
// would stop the wrapper rather than the server.
function resolveNextCli() {
  try {
    const requireFromWeb = createRequire(join(WEB, "package.json"));
    const { bin } = requireFromWeb("next/package.json");
    return join(
      dirname(requireFromWeb.resolve("next/package.json")),
      typeof bin === "string" ? bin : bin.next,
    );
  } catch {
    return null;
  }
}
const NEXT_CLI = resolveNextCli();

const PREVIEW_ROUTES = [
  "/design-preview",
  "/design-preview/gallery",
  "/design-preview/buyer/projects",
  "/design-preview/buyer/quotes",
  "/design-preview/ops/quote-review",
  "/design-preview/ops/audit",
  "/design-preview/supplier/quotes",
];
// Content only the prototype screens render (layout theme script, runtime font link, synthetic data). None may
// appear in a 404 body; each must appear on at least one page in the positive control, so a stale marker fails
// loudly instead of passing vacuously.
const SCREEN_MARKERS = [
  "fbg-design-preview-theme",
  "fonts.googleapis.com",
  "Supplier A (demo)",
  "Custom BOPP roll labels",
];
// Name leak (report-only): the 404 should not reveal that a prototype route exists. Before B-31 (#37) Next.js resolved
// the preview segment's static `metadata`, so the 404 <title> and RSC payload named "Design preview … (demo data)".
// Checked over the WHOLE body (title + RSC payload) and reported as WARN, not failure; see the M0 report §4.
const PREVIEW_NAME_LEAK = /design preview|demo data/i;
// The site-wide branded 404 (apps/web/src/app/not-found.tsx, copy in apps/web/src/site/content.ts NOT_FOUND).
const NOT_FOUND_TEXT = "Page not found";
// The public homepage hero — proves `/` is the real site. The <h1 id="hero-heading"> is in
// apps/web/src/site/components/SiteHome.tsx; its three lines are apps/web/src/site/content.ts HERO.headline, each
// in its own <span>. Matched by id and text fragments, not exact markup, so styling changes do not break the gate.
const HERO_HEADING = /<h1\b[^>]*\bid="hero-heading"/;
const HOME_MARKERS = ["Source better.", "Verify quality.", "Know your true cost"];

const SCENARIOS = [
  { name: "no APP_ENV, no DESIGN_PREVIEW", env: {}, previewStatus: 404 },
  {
    name: "DESIGN_PREVIEW=enabled without APP_ENV",
    env: { DESIGN_PREVIEW: "enabled" },
    previewStatus: 404,
  },
  {
    name: "APP_ENV=production + DESIGN_PREVIEW=enabled",
    env: { APP_ENV: "production", DESIGN_PREVIEW: "enabled" },
    previewStatus: 404,
  },
  {
    name: "positive control: APP_ENV=staging + DESIGN_PREVIEW=enabled",
    env: { APP_ENV: "staging", DESIGN_PREVIEW: "enabled" },
    previewStatus: 200,
  },
];

const failures = [];
const warnings = new Set();
const markersSeenOnPreview = new Set();
const log = (line) => process.stdout.write(`${line}\n`);

function check(ok, message) {
  log(`${ok ? "  ok  " : "  FAIL"} ${message}`);
  if (!ok) failures.push(message);
}

function cleanEnv(extra) {
  const env = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  delete env.APP_ENV;
  delete env.DESIGN_PREVIEW;
  return { ...env, ...extra };
}

async function waitForServer(base, child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`next start exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(`${base}/api/health`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server at ${base} did not start within ${timeoutMs} ms`);
}

async function get(base, path) {
  const res = await fetch(`${base}${path}`, { redirect: "manual" });
  return { status: res.status, body: await res.text() };
}

async function runScenario(scenario, port) {
  log(`\n▶ ${scenario.name} (port ${port})`);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(
    process.execPath,
    [NEXT_CLI, "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: WEB,
      env: cleanEnv(scenario.env),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  try {
    await waitForServer(base, child);

    const home = await get(base, "/");
    check(home.status === 200, `/ → ${home.status} (expected 200)`);
    check(HERO_HEADING.test(home.body), '/ renders the public site hero (<h1 id="hero-heading">)');
    const missingHome = HOME_MARKERS.filter((marker) => !home.body.includes(marker));
    check(
      missingHome.length === 0,
      `/ renders the homepage headline${missingHome.length ? ` (missing: ${missingHome.join(", ")})` : ""}`,
    );
    check(
      /<meta name="robots" content="noindex/.test(home.body),
      "/ is served noindex (no indexing opt-in)",
    );
    const robots = await get(base, "/robots.txt");
    check(
      robots.status === 200 && /Disallow: \/\s*$/m.test(robots.body),
      `/robots.txt disallows everything (status ${robots.status})`,
    );
    const health = await get(base, "/api/health");
    check(health.status === 200, `/api/health → ${health.status} (expected 200)`);

    for (const route of PREVIEW_ROUTES) {
      const res = await get(base, route);
      check(
        res.status === scenario.previewStatus,
        `${route} → ${res.status} (expected ${scenario.previewStatus})`,
      );
      if (scenario.previewStatus === 404) {
        check(res.body.includes(NOT_FOUND_TEXT), `${route} renders the site-wide not-found page`);
        const leaked = SCREEN_MARKERS.filter((marker) => res.body.includes(marker));
        check(
          leaked.length === 0,
          `${route} 404 carries no prototype screen content${leaked.length ? ` (found: ${leaked.join(", ")})` : ""}`,
        );
        const leak = PREVIEW_NAME_LEAK.exec(res.body);
        if (leak) {
          const at = res.body
            .slice(Math.max(0, leak.index - 60), leak.index + 60)
            .replace(/\s+/g, " ");
          warnings.add(`${route}: 404 body still names the prototype ("…${at}…")`);
        } else {
          log(`  ok   ${route} 404 body does not name the prototype (title + RSC payload)`);
        }
      } else {
        for (const marker of SCREEN_MARKERS)
          if (res.body.includes(marker)) markersSeenOnPreview.add(marker);
      }
    }
  } catch (error) {
    check(false, `${scenario.name}: ${error instanceof Error ? error.message : String(error)}`);
    log(output.slice(-2000));
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", resolve);
    });
  }
}

if (!existsSync(join(WEB, ".next", "BUILD_ID"))) {
  console.error(
    "No production build found at apps/web/.next — run `pnpm --filter @fbg/web build` first.",
  );
  process.exit(1);
}
if (!NEXT_CLI || !existsSync(NEXT_CLI)) {
  console.error(
    `next CLI not found (resolved from ${WEB}: ${NEXT_CLI ?? "unresolvable"}) — run \`pnpm install\` first.`,
  );
  process.exit(1);
}

let port = 3910;
for (const scenario of SCENARIOS) {
  await runScenario(scenario, port++);
}

for (const marker of SCREEN_MARKERS) {
  check(
    markersSeenOnPreview.has(marker),
    `positive control renders marker "${marker}" somewhere (marker is live)`,
  );
}
if (warnings.size > 0)
  log(
    "\nKnown gaps (reported, not failures — see docs/reports/2026-11-09_OPUS_5_5_M0_RECONCILIATION_REPORT.md):",
  );
for (const warning of warnings) log(`  WARN ${warning}`);

if (failures.length > 0) {
  console.error(
    `\nProduction build gate FAILED (${failures.length}):\n - ${failures.join("\n - ")}`,
  );
  process.exit(1);
}
log(
  "\nProduction build gate passed: the public site renders noindex with robots disallowed; every probed /design-preview route is a 404 with no prototype screen content in every production configuration, and is served only when a non-production host opts in.",
);
