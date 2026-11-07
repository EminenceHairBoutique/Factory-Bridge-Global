/**
 * Versioned prompt template registry (ADR-007; AI_EVALUATION_PLAN.md §2).
 *
 * Templates live at packages/ai/prompts/<id>/<version>.md:
 *
 *   ---
 *   id: quotation_extractor
 *   version: 1.0.0
 *   schema: quote_extraction_v1
 *   purpose: extract
 *   ---
 *   <system instructions>
 *   === USER ===
 *   <user message with {{CONTEXT}} and {{DOCUMENTS}} placeholders>
 *
 * The sha256 of the file bytes is returned as `hash` and stored by callers as
 * `ai_runs.prompt_version`, so any edit to a template is visible in the audit trail.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiPurpose, PromptTemplateRef } from "../contract.js";

export interface LoadedTemplate {
  readonly id: string;
  readonly version: string;
  readonly schema: string;
  readonly purpose: AiPurpose;
  readonly system: string;
  readonly user: string;
  readonly hash: string;
  readonly path: string;
}

const ID_RE = /^[a-z][a-z0-9_]{0,63}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const PURPOSES: readonly AiPurpose[] = [
  "extract",
  "translate",
  "normalize",
  "match",
  "draft",
  "flag",
];
const USER_SEPARATOR = /\r?\n=== USER ===\r?\n/;

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

export const PROMPTS_DIR = fileURLToPath(new URL("../../prompts/", import.meta.url));

const cache = new Map<string, LoadedTemplate>();

function templatePath(ref: PromptTemplateRef): string {
  if (!ID_RE.test(ref.id))
    throw new TemplateError(`invalid template id: ${JSON.stringify(ref.id)}`);
  if (!VERSION_RE.test(ref.version)) {
    throw new TemplateError(`invalid template version: ${JSON.stringify(ref.version)}`);
  }
  return join(PROMPTS_DIR, ref.id, `${ref.version}.md`);
}

export function parseTemplateFile(
  raw: string,
  ref: PromptTemplateRef,
  path: string,
): LoadedTemplate {
  const text = raw.replace(/\r\n?/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (fm === null) throw new TemplateError(`${path}: missing front matter`);
  const meta: Record<string, string> = {};
  for (const line of (fm[1] ?? "").split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const body = fm[2] ?? "";
  const parts = body.split(USER_SEPARATOR);
  if (parts.length !== 2)
    throw new TemplateError(`${path}: expected exactly one "=== USER ===" separator`);
  const system = (parts[0] ?? "").trim();
  const user = (parts[1] ?? "").trim();
  if (meta.id !== ref.id)
    throw new TemplateError(`${path}: front matter id ${meta.id ?? "(none)"} != ${ref.id}`);
  if (meta.version !== ref.version) {
    throw new TemplateError(
      `${path}: front matter version ${meta.version ?? "(none)"} != ${ref.version}`,
    );
  }
  const purpose = meta.purpose;
  if (purpose === undefined || !PURPOSES.includes(purpose as AiPurpose)) {
    throw new TemplateError(`${path}: purpose must be one of ${PURPOSES.join(", ")}`);
  }
  if (meta.schema === undefined || meta.schema.length === 0)
    throw new TemplateError(`${path}: schema missing`);
  if (!user.includes("{{DOCUMENTS}}"))
    throw new TemplateError(`${path}: user section must contain {{DOCUMENTS}}`);
  if (system.length === 0) throw new TemplateError(`${path}: system section is empty`);
  return {
    id: ref.id,
    version: ref.version,
    schema: meta.schema,
    purpose: purpose as AiPurpose,
    system,
    user,
    hash: createHash("sha256").update(raw).digest("hex"),
    path,
  };
}

export function getTemplate(ref: PromptTemplateRef): LoadedTemplate {
  const key = `${ref.id}@${ref.version}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const path = templatePath(ref);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new TemplateError(`template not found: ${key} (${path})`);
  }
  const loaded = parseTemplateFile(raw, ref, path);
  cache.set(key, loaded);
  return loaded;
}

/** Lists every template version on disk (used by tests and the eval harness). */
export function listTemplates(): PromptTemplateRef[] {
  const refs: PromptTemplateRef[] = [];
  for (const id of readdirSync(PROMPTS_DIR)) {
    const dir = join(PROMPTS_DIR, id);
    if (!statSync(dir).isDirectory() || !ID_RE.test(id)) continue;
    for (const file of readdirSync(dir)) {
      const m = /^(\d+\.\d+\.\d+)\.md$/.exec(file);
      if (m?.[1] !== undefined) refs.push({ id, version: m[1] });
    }
  }
  return refs.sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`));
}
