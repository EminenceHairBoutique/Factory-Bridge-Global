/**
 * Regenerates the enum block inside the bootstrap migration from packages/domain/src/enums.ts.
 * Usage: pnpm db:gen-enums   (root)  — then review the diff and commit.
 * NOTE: Postgres enums are append-only in practice; editing an already-deployed enum requires a new
 * migration with `alter type ... add value`, not a regenerated 0001. The drift test only guards 0001
 * while 0001 is the sole migration that defines these types.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateEnumSql, spliceEnumBlock } from "@fbg/domain/sql/enum-sql";

const target = fileURLToPath(
  new URL("../migrations/20261107000100_bootstrap.sql", import.meta.url),
);
const before = readFileSync(target, "utf8");
const after = spliceEnumBlock(before, generateEnumSql());
if (after === before) {
  console.warn("enum block already up to date");
} else {
  writeFileSync(target, after);
  console.warn(`updated enum block in ${target}`);
}
