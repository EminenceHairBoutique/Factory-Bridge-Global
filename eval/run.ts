/**
 * eval/run.ts — golden-set evaluation for the quotation extractor (AI_EVALUATION_PLAN.md §3).
 *
 *   pnpm eval                               # mock provider: harness/fixture self-test, free, offline
 *   pnpm eval -- --provider anthropic       # LIVE: requires ANTHROPIC_API_KEY, spends real money
 *   pnpm eval -- --only inj-price-override,zh-pdf-basic-tiers --json eval/results/run.json
 *
 * Options: --provider mock|anthropic  --model <id>  --only <id,id>  --limit <n>  --concurrency <n>  --json <path>
 * Exit codes: 0 ok · 1 hard gate violated or fixture invalid · 2 live provider requested without a key.
 * CI never passes --provider anthropic; the AnthropicProvider cannot be built without the key.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { AnthropicProvider, type AiProvider } from "@fbg/ai";
import { FixtureError, loadFixtures, type Fixture } from "./src/fixtures.js";
import { mockProviderFromFixtures, runFixtures, TEMPLATE } from "./src/harness.js";
import { computeReport } from "./src/metrics.js";
import { renderReport } from "./src/report.js";

interface Args {
  provider: "mock" | "anthropic";
  model?: string;
  only?: string[];
  limit?: number;
  concurrency: number;
  json?: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { provider: "mock", concurrency: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    const v = argv[i + 1];
    switch (a) {
      case "--provider":
        if (v !== "mock" && v !== "anthropic")
          throw new Error(`--provider must be mock|anthropic, got ${String(v)}`);
        args.provider = v;
        i += 1;
        break;
      case "--model":
        if (v === undefined) throw new Error("--model needs a value");
        args.model = v;
        i += 1;
        break;
      case "--only":
        if (v === undefined) throw new Error("--only needs a value");
        args.only = v
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        i += 1;
        break;
      case "--limit":
        args.limit = Number(v);
        if (!Number.isInteger(args.limit) || args.limit < 1)
          throw new Error("--limit must be a positive integer");
        i += 1;
        break;
      case "--concurrency":
        args.concurrency = Number(v);
        if (!Number.isInteger(args.concurrency) || args.concurrency < 1)
          throw new Error("--concurrency must be a positive integer");
        i += 1;
        break;
      case "--json":
        if (v === undefined) throw new Error("--json needs a path");
        args.json = v;
        i += 1;
        break;
      default:
        throw new Error(`unknown argument: ${String(a)}`);
    }
  }
  return args;
}

const write = (s: string) => process.stdout.write(`${s}\n`);

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  let fixtures: Fixture[];
  try {
    fixtures = loadFixtures();
  } catch (err) {
    if (err instanceof FixtureError) {
      process.stderr.write(`fixture error: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
  if (args.only !== undefined) {
    const wanted = new Set(args.only);
    fixtures = fixtures.filter((f) => wanted.has(f.id));
    const missing = [...wanted].filter((id) => !fixtures.some((f) => f.id === id));
    if (missing.length > 0) {
      process.stderr.write(`unknown fixture id(s): ${missing.join(", ")}\n`);
      return 1;
    }
  }
  if (args.limit !== undefined) fixtures = fixtures.slice(0, args.limit);

  let provider: AiProvider;
  let model: string;
  if (args.provider === "anthropic") {
    const live = AnthropicProvider.fromEnv();
    if (live === null) {
      process.stderr.write(
        "ANTHROPIC_API_KEY is not set; refusing to run the live provider. Use the default mock provider for a free self-test.\n",
      );
      return 2;
    }
    provider =
      args.model !== undefined
        ? new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY ?? "", model: args.model })
        : live;
    model = (provider as AnthropicProvider).model;
    write(
      `LIVE RUN: ${fixtures.length} fixture(s) against ${model}. This spends real API money (budget gate G2).`,
    );
  } else {
    provider = mockProviderFromFixtures(fixtures);
    model = "mock";
  }

  const started = Date.now();
  const runs = await runFixtures(provider, fixtures, {
    concurrency: args.provider === "anthropic" ? args.concurrency : 1,
    onResult: (run) => {
      const status = run.result.ok ? "ok" : `${run.result.error}`;
      process.stderr.write(`  ${run.fixture.id.padEnd(32)} ${status}\n`);
    },
  });
  const report = computeReport(runs, {
    provider: provider.name,
    model,
    template: `${TEMPLATE.id}@${TEMPLATE.version}`,
  });

  write(renderReport(report));
  write(`\nwall time: ${Date.now() - started} ms`);

  if (args.json !== undefined) {
    mkdirSync(dirname(args.json), { recursive: true });
    const detail = runs.map((r) => ({ id: r.fixture.id, result: r.result }));
    writeFileSync(args.json, JSON.stringify({ report, runs: detail }, null, 2));
    write(`wrote ${args.json}`);
  }

  return report.hardGateViolations.length === 0 ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exitCode = 1;
  },
);
