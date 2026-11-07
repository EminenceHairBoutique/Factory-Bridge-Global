/**
 * CI smoke subset (AI_EVALUATION_PLAN.md §3.3): every fixture runs through the full pipeline with
 * MockProvider. Verifies fixtures, harness wiring, hard gates and metric plumbing. Never calls the API.
 */
import { describe, expect, it } from "vitest";
import { loadFixtures } from "./fixtures.js";
import { mockProviderFromFixtures, runFixtures, TEMPLATE } from "./harness.js";
import { computeReport } from "./metrics.js";
import { renderReport } from "./report.js";

const fixtures = loadFixtures();

describe("synthetic fixture set", () => {
  it("has at least 15 fixtures, at least 5 of them prompt-injection cases, all synthetic", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(15);
    expect(fixtures.filter((f) => f.meta.injection).length).toBeGreaterThanOrEqual(5);
    expect(fixtures.every((f) => f.meta.synthetic)).toBe(true);
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length);
  });

  it("covers the ADR-025 colloquial-term cases and every injection fixture expects the detection flag", () => {
    expect(fixtures.filter((f) => f.meta.colloquialBasis).length).toBeGreaterThanOrEqual(3);
    for (const f of fixtures.filter((f) => f.meta.colloquialBasis)) {
      expect(f.expected.priceBasis.value, f.id).toBeNull();
      expect(f.expected.flags, f.id).toContain("basis_term_colloquial");
    }
    for (const f of fixtures.filter((f) => f.meta.injection)) {
      expect(f.expected.flags, f.id).toContain("embedded_instruction_detected");
      expect(f.meta.forbiddenOutputStrings.length, f.id).toBeGreaterThan(0);
    }
  });

  it("every anchor quote in expected.json is a literal substring of its source (labeler consistency)", () => {
    for (const f of fixtures) {
      const anchors: string[] = [];
      const walk = (v: unknown) => {
        if (v === null || typeof v !== "object") return;
        if (Array.isArray(v)) {
          v.forEach(walk);
          return;
        }
        const o = v as Record<string, unknown>;
        if (typeof o.quote === "string" && "page" in o) anchors.push(o.quote);
        Object.values(o).forEach(walk);
      };
      walk(f.expected);
      for (const q of anchors) expect(f.source.includes(q), `${f.id}: anchor "${q}"`).toBe(true);
    }
  });

  it("expected outputs never contain their own forbidden strings or a canary", () => {
    for (const f of fixtures) {
      const text = JSON.stringify(f.expected).toLowerCase();
      for (const s of f.meta.forbiddenOutputStrings)
        expect(text.includes(s.toLowerCase()), `${f.id}: ${s}`).toBe(false);
    }
  });
});

describe("harness self-test with MockProvider", () => {
  it("runs every fixture through the pipeline, meets every gate, and reports 0 hard-gate violations", async () => {
    const provider = mockProviderFromFixtures(fixtures);
    const runs = await runFixtures(provider, fixtures);
    expect(runs).toHaveLength(fixtures.length);
    expect(runs.every((r) => r.result.ok)).toBe(true);
    expect(provider.calls).toHaveLength(fixtures.length);

    const report = computeReport(runs, {
      provider: provider.name,
      model: provider.model,
      template: `${TEMPLATE.id}@${TEMPLATE.version}`,
    });
    expect(report.hardGateViolations).toEqual([]);
    expect(report.promptHash).toMatch(/^[0-9a-f]{64}$/);
    const failing = report.overall.filter((r) => r.pass === false).map((r) => r.key);
    expect(failing).toEqual([]);
    const byKey = Object.fromEntries(report.overall.map((r) => [r.key, r.value]));
    expect(byKey["tier_structure_accuracy"]).toBe(1);
    expect(byKey["null_correctness"]).toBe(1);
    expect(byKey["hallucination_rate"]).toBe(0);
    expect(byKey["anchor_validity"]).toBe(1);
    expect(byKey["injection_boundary_violations"]).toBe(0);
    expect(byKey["injection_detection"]).toBe(1);
    expect(byKey["price_basis_caution"]).toBe(1);
    expect(byKey["basis_guesses"]).toBe(0);
    expect(Object.keys(report.perSlice).length).toBeGreaterThanOrEqual(4);

    const text = renderReport(report);
    expect(text).toContain("provider=mock");
    expect(text).toContain("says NOTHING about model accuracy");
    expect(text).toContain("HARD GATE (injection boundary): 0 violations");
    for (const f of fixtures) expect(text).toContain(f.id);
  });

  it("wraps the fixture source as untrusted data in the user turn and keeps it out of the system prompt", async () => {
    const provider = mockProviderFromFixtures(fixtures);
    const inj = fixtures.find((f) => f.id === "inj-cross-tenant-reveal")!;
    await runFixtures(provider, [inj]);
    const turn = provider.calls[0]!;
    expect(turn.system.stable).not.toContain("Acme");
    expect(turn.messages[0]!.content).toContain(`boundary="${turn.tokens.boundary}">>>`);
    expect(turn.messages[0]!.content).toContain("Acme Imports");
  });
});
