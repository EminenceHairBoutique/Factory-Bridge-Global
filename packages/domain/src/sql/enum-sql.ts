/**
 * Deterministic Postgres DDL for every enum in ENUM_REGISTRY (ADR-019, B-03).
 * Pure string generation — the only source of truth for DB enums is packages/domain/src/enums.ts.
 * The committed migration embeds this output between marker comments; a drift test keeps them equal.
 */
import { ENUM_REGISTRY } from "../enums.js";

export const ENUM_BLOCK_BEGIN =
  "-- BEGIN GENERATED ENUMS (packages/domain/src/enums.ts) — do not edit by hand";
export const ENUM_BLOCK_END = "-- END GENERATED ENUMS";

const IDENT = /^[a-z][a-z0-9_]*$/;
const LABEL = /^[A-Za-z0-9_]+$/; // labels are quoted literals; Incoterm codes are upper-case by design

function assertIdent(name: string): void {
  if (!IDENT.test(name)) throw new Error(`Invalid SQL identifier for enum: "${name}"`);
}

function sqlLiteral(v: string): string {
  if (v.includes("'")) throw new Error(`Enum label must not contain a quote: ${v}`);
  return `'${v}'`;
}

/** One `create type` statement per enum, sorted by name for a stable diff. */
export function generateEnumSql(
  registry: Record<string, readonly string[]> = ENUM_REGISTRY,
): string {
  const names = Object.keys(registry).sort();
  const lines: string[] = [ENUM_BLOCK_BEGIN];
  for (const name of names) {
    assertIdent(name);
    const values = registry[name];
    if (!values || values.length === 0) throw new Error(`Enum ${name} has no values`);
    const seen = new Set<string>();
    for (const v of values) {
      if (!LABEL.test(v)) throw new Error(`Invalid enum label for ${name}: "${v}"`);
      if (seen.has(v)) throw new Error(`Enum ${name} has duplicate value ${v}`);
      seen.add(v);
    }
    lines.push(`create type public.${name} as enum (${values.map(sqlLiteral).join(", ")});`);
  }
  lines.push(ENUM_BLOCK_END);
  return lines.join("\n");
}

/** Replace (or validate) the generated block inside a migration file's text. */
export function spliceEnumBlock(migrationSql: string, block: string): string {
  const start = migrationSql.indexOf(ENUM_BLOCK_BEGIN);
  const end = migrationSql.indexOf(ENUM_BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Migration is missing the generated-enum marker block");
  }
  const endFull = end + ENUM_BLOCK_END.length;
  return migrationSql.slice(0, start) + block + migrationSql.slice(endFull);
}

export function extractEnumBlock(migrationSql: string): string {
  const start = migrationSql.indexOf(ENUM_BLOCK_BEGIN);
  const end = migrationSql.indexOf(ENUM_BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Migration is missing the generated-enum marker block");
  }
  return migrationSql.slice(start, end + ENUM_BLOCK_END.length);
}
