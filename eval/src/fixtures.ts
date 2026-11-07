/**
 * Fixture loader. Layout (AI_EVALUATION_PLAN.md §3.1): eval/fixtures/<id>/{source.txt,expected.json,meta.json}.
 * Every fixture in this repository is SYNTHETIC (meta.synthetic must be true). Real, authorized,
 * redacted documents arrive with B-30 and must never include unredacted supplier contacts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { quoteExtractionV1, type QuoteExtractionV1 } from "@fbg/ai";
import { z } from "zod";

export const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/", import.meta.url));

export const SLICES = [
  "zh_quotation_pdf",
  "zh_en_xlsx_tiers",
  "en_trading_pdf",
  "wechat_text",
  "photo_handwritten",
  "email_body",
  "synthetic_adversarial",
] as const;

export const fixtureMeta = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,60}$/),
  slice: z.enum(SLICES),
  locale: z.enum(["zh-CN", "en-US", "mixed"]),
  layout: z.string().min(1).max(60),
  family: z.string().min(1).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  synthetic: z.literal(true),
  injection: z.boolean(),
  colloquialBasis: z.boolean(),
  /** Strings that must never appear in a validated output for this fixture (hard boundary gate). */
  forbiddenOutputStrings: z.array(z.string().min(1)).max(20),
  tags: z.array(z.string().max(40)).max(20),
});

export type FixtureMeta = z.infer<typeof fixtureMeta>;

export interface Fixture {
  readonly id: string;
  readonly dir: string;
  readonly source: string;
  readonly expected: QuoteExtractionV1;
  readonly meta: FixtureMeta;
}

export class FixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureError";
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (err) {
    throw new FixtureError(`${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function loadFixture(dir: string): Fixture {
  const id =
    dir
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() ?? "";
  for (const f of ["source.txt", "expected.json", "meta.json"]) {
    if (!existsSync(join(dir, f))) throw new FixtureError(`${id}: missing ${f}`);
  }
  const source = readFileSync(join(dir, "source.txt"), "utf8").replace(/\r\n?/g, "\n");
  const expectedParse = quoteExtractionV1.safeParse(readJson(join(dir, "expected.json")));
  if (!expectedParse.success) {
    throw new FixtureError(
      `${id}: expected.json does not validate: ${expectedParse.error.message}`,
    );
  }
  const metaParse = fixtureMeta.safeParse(readJson(join(dir, "meta.json")));
  if (!metaParse.success)
    throw new FixtureError(`${id}: meta.json does not validate: ${metaParse.error.message}`);
  if (metaParse.data.id !== id)
    throw new FixtureError(`${id}: meta.id ${metaParse.data.id} != directory name`);
  return { id, dir, source, expected: expectedParse.data, meta: metaParse.data };
}

export function loadFixtures(root: string = FIXTURES_DIR): Fixture[] {
  const dirs = readdirSync(root)
    .map((name) => join(root, name))
    .filter((p) => statSync(p).isDirectory())
    .sort();
  return dirs.map(loadFixture);
}
