#!/usr/bin/env node
// Generated database types (M0-C). packages/db/src/types.ts is NEVER hand-written: this script asks the Supabase
// CLI to generate TypeScript for schema `public` from a database that has the migration chain applied, formats it
// with the repo's Prettier config (the CLI's raw output is unformatted), and writes it — or, with --check, fails
// when the committed file differs and writes the regenerated file to $RUNNER_TEMP (CI uploads it as an artifact).
//
//   node scripts/gen-db-types.mjs                     # write   (after `supabase start && supabase db reset`)
//   node scripts/gen-db-types.mjs --check             # CI drift check
//   node scripts/gen-db-types.mjs --db-url <url>      # any Postgres with the chain applied (default: local stack)
//
// The CLI comes from PATH (CI pins supabase/setup-cli to the version below) or from $SUPABASE_BIN.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const PINNED_CLI = "3.1.0"; // keep in step with .github/workflows/ci.yml (supabase/setup-cli `version`)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "packages", "db", "src", "types.ts");
const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"; // `supabase start`

const args = process.argv.slice(2);
const check = args.includes("--check");
const urlFlag = args.indexOf("--db-url");
const dbUrl = urlFlag >= 0 ? args[urlFlag + 1] : DEFAULT_DB_URL;
if (!dbUrl) {
  console.error("--db-url needs a value");
  process.exit(2);
}
const cli = process.env.SUPABASE_BIN || "supabase";

function run(argv) {
  const res = spawnSync(cli, argv, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  if (res.error) throw res.error;
  return res;
}

const version = run(["--version"]).stdout.trim();
if (version !== PINNED_CLI) {
  console.error(
    `Supabase CLI ${version || "(not found)"} — this repo pins ${PINNED_CLI} so generated types are reproducible.`,
  );
  process.exit(2);
}

const gen = run(["gen", "types", "typescript", `--remote=${dbUrl}`, "--schema", "public"]);
if (gen.status !== 0 || !gen.stdout.includes("export type Database")) {
  console.error(`supabase gen types failed (exit ${gen.status}):\n${gen.stderr.slice(-2000)}`);
  process.exit(1);
}

const header =
  "// GENERATED FILE — do not edit. Source: the migration chain in supabase/migrations, via\n" +
  `// \`supabase gen types typescript --schema public\` (Supabase CLI ${PINNED_CLI}) formatted with Prettier.\n` +
  "// Regenerate: `pnpm db:gen-types`. CI's `db` job fails when this file drifts from the migrations.\n";
const config = (await prettier.resolveConfig(TARGET)) ?? {};
const generated = await prettier.format(header + gen.stdout, { ...config, filepath: TARGET });

if (!check) {
  writeFileSync(TARGET, generated);
  process.stdout.write(`wrote ${TARGET} (${generated.split("\n").length} lines)\n`);
  process.exit(0);
}

const committed = existsSync(TARGET) ? readFileSync(TARGET, "utf8") : "";
if (committed === generated) {
  process.stdout.write(
    "packages/db/src/types.ts matches a fresh generation from the migrations.\n",
  );
  process.exit(0);
}

const outDir = process.env.RUNNER_TEMP || mkdtempSync(join(tmpdir(), "fbg-db-types-"));
const outFile = join(outDir, "types.ts");
writeFileSync(outFile, generated);
// Bounded, readable diff in the log (a full diff of a large file can overrun the CI log pipe).
const diff = spawnSync("diff", ["-u", existsSync(TARGET) ? TARGET : "/dev/null", outFile], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const lines = (diff.stdout || "").split("\n");
process.stdout.write(lines.slice(0, 400).join("\n") + "\n");
if (lines.length > 400)
  process.stdout.write(`… ${lines.length - 400} more diff lines (see the artifact)\n`);
console.error(
  `packages/db/src/types.ts is ${committed ? "stale" : "missing"}: regenerate with \`pnpm db:gen-types\` ` +
    `(after supabase db reset). Regenerated file: ${outFile}`,
);
process.exit(1);
