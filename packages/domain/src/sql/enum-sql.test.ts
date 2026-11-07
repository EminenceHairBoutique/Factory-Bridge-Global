import { describe, expect, it } from "vitest";
import { ENUM_REGISTRY } from "../enums.js";
import {
  ENUM_BLOCK_BEGIN,
  ENUM_BLOCK_END,
  extractEnumBlock,
  generateEnumSql,
  spliceEnumBlock,
} from "./enum-sql.js";

describe("enum SQL generator (B-03)", () => {
  it("emits one create type per registry entry, sorted, wrapped in markers", () => {
    const sql = generateEnumSql();
    const lines = sql.split("\n");
    expect(lines[0]).toBe(ENUM_BLOCK_BEGIN);
    expect(lines.at(-1)).toBe(ENUM_BLOCK_END);
    const types = lines.slice(1, -1);
    expect(types).toHaveLength(Object.keys(ENUM_REGISTRY).length);
    const names = types.map((l) => /create type public\.(\w+) as enum/.exec(l)?.[1]);
    expect(names).toEqual([...names].sort());
  });

  it("is deterministic and reflects the lifecycle enum of ADR-021", () => {
    expect(generateEnumSql()).toBe(generateEnumSql());
    expect(generateEnumSql()).toContain(
      "create type public.quote_status as enum ('confirmed', 'superseded', 'expired', 'withdrawn');",
    );
    expect(generateEnumSql()).toContain("'unknown'"); // price_basis keeps the explicit unknown
  });

  it("rejects unsafe identifiers and duplicates", () => {
    expect(() => generateEnumSql({ "bad-name": ["a"] })).toThrow(/Invalid SQL identifier/);
    expect(() => generateEnumSql({ ok: ["a", "a"] })).toThrow(/duplicate/);
    expect(() => generateEnumSql({ ok: ["it's"] })).toThrow(/Invalid enum label/);
  });

  it("splices and extracts the block inside a migration", () => {
    const file = `-- header\n${ENUM_BLOCK_BEGIN}\nstale\n${ENUM_BLOCK_END}\n-- footer`;
    const spliced = spliceEnumBlock(file, generateEnumSql());
    expect(extractEnumBlock(spliced)).toBe(generateEnumSql());
    expect(spliced.startsWith("-- header\n")).toBe(true);
    expect(spliced.endsWith("\n-- footer")).toBe(true);
    expect(() => extractEnumBlock("no markers")).toThrow(/marker/);
  });
});
