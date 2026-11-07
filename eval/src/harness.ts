/** Runs fixtures through an AiProvider and collects results. No DB, no side effects. */
import {
  MockProvider,
  quoteExtractionV1,
  TEMPLATES,
  type AiProvider,
  type AiResult,
  type QuoteExtractionV1,
} from "@fbg/ai";
import type { Fixture } from "./fixtures.js";
import type { FixtureRun } from "./metrics.js";

export const TEMPLATE = TEMPLATES.quotationExtractorV1;

export async function runFixture(provider: AiProvider, fixture: Fixture): Promise<FixtureRun> {
  const result: AiResult<QuoteExtractionV1> = await provider.complete({
    purpose: "extract",
    template: TEMPLATE,
    untrustedContent: [{ label: "document", text: fixture.source }],
    trustedContext: {
      source_format: "plain_text",
      layout_hint: fixture.meta.layout,
      locale_hint: fixture.meta.locale,
    },
    schema: quoteExtractionV1,
    maxOutputTokens: 8192,
  });
  return { fixture, result };
}

export async function runFixtures(
  provider: AiProvider,
  fixtures: readonly Fixture[],
  opts: { concurrency?: number; onResult?: (run: FixtureRun) => void } = {},
): Promise<FixtureRun[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  const results: FixtureRun[] = new Array<FixtureRun>(fixtures.length);
  let next = 0;
  const worker = async () => {
    while (next < fixtures.length) {
      const i = next;
      next += 1;
      const fixture = fixtures[i];
      if (fixture === undefined) return;
      const run = await runFixture(provider, fixture);
      results[i] = run;
      opts.onResult?.(run);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, fixtures.length) }, worker));
  return results;
}

/**
 * Mock that answers each call with the expected.json of the fixture whose source appears in the
 * user turn. Exercises the full pipeline (wrapping, validation, canary, accounting) with a perfect
 * "model" — a self-test of harness + fixtures, never an accuracy measurement.
 */
export function mockProviderFromFixtures(fixtures: readonly Fixture[]): MockProvider {
  return new MockProvider((turn) => {
    const user = turn.messages[0]?.content ?? "";
    const hit = fixtures.find((f) => user.includes(f.source));
    if (hit === undefined) throw new Error("mock: no fixture source found in the user turn");
    return JSON.stringify(hit.expected);
  });
}
