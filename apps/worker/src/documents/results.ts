/**
 * Validation of what the parser sandbox returns (B-12). The sandbox handles hostile files, so its output is as
 * untrusted as the files: every response is parsed against a strict schema and re-checked against the same limits
 * the sandbox was given before anything is stored. Text is made storable (no NUL, no lone surrogates) here, in the
 * trusted process, rather than relying on the sandbox to have done it.
 */
import { z } from "zod";
import type { SandboxLimits } from "./sandbox/protocol.mts";

const flag = z.string().regex(/^[a-z][a-z0-9_]{1,47}$/);
const flags = z.array(flag).max(32);
const finite = z.number().refine((n) => Number.isFinite(n), "must be finite");

/** Postgres text and jsonb accept neither U+0000 nor an unpaired surrogate. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function storableText(text: string): string {
  return text.replace(LONE_SURROGATE, "�").replaceAll("\u0000", "");
}

const text = z.string().transform(storableText);

const pdfItem = z.tuple([finite, finite, finite, finite, text]);

const pdfPage = z.strictObject({
  pageNo: z.number().int().min(1),
  width: finite,
  height: finite,
  rotation: z.number().int().min(0).max(359),
  text,
  items: z.array(pdfItem),
  itemsTruncated: z.boolean(),
});

const pdfResult = z.strictObject({
  kind: z.literal("pdf"),
  pageCount: z.number().int().min(1),
  pages: z.array(pdfPage),
  flags,
});

const sheetMeta = z.strictObject({
  // length is checked AFTER the text is made storable: a name of NULs would otherwise become "" and break the insert
  name: z.string().max(64).transform(storableText).pipe(z.string().min(1)),
  hidden: z.boolean(),
  cellCount: z.number().int().min(0),
});

const sheetCell = z.strictObject({
  s: z.number().int().min(0),
  r: z.number().int().min(1).max(1_048_576),
  c: z.number().int().min(1).max(16_384),
  v: text.nullable(),
  t: z.enum(["n", "s", "b", "e", "d"]),
  f: z.literal(1).optional(),
  z: z.string().max(255).transform(storableText).optional(),
  d: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?|\d{2}:\d{2}:\d{2})$/)
    .optional(),
});

const sheetResult = z.strictObject({
  kind: z.literal("sheet"),
  format: z.enum(["xlsx", "csv"]),
  sheets: z.array(sheetMeta).min(1),
  cells: z.array(sheetCell),
  flags,
  encoding: z.enum(["utf-8", "utf-16le", "utf-16be", "gb18030"]).optional(),
  delimiter: z.enum([",", ";", "|", "tab"]).optional(),
});

const imageResult = z.strictObject({
  kind: z.literal("image"),
  format: z.enum(["jpeg", "png", "webp"]),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  outputBytes: z.number().int().min(1),
  flags,
});

const parseResult = z.discriminatedUnion("kind", [pdfResult, sheetResult, imageResult]);

const rejectCode = z.enum([
  "corrupt_file",
  "encrypted_file",
  "macro_enabled",
  "zip_bomb",
  "too_many_pages",
  "too_many_cells",
  "unsupported_structure",
  "unsupported_encoding",
  "type_mismatch",
  "image_too_large",
  "output_too_large",
  "too_large",
]);

const outcome = z.enum(["denied", "allowed"]);

const probeResult = z.strictObject({
  fsRead: outcome,
  fsWrite: outcome,
  childProcess: outcome,
  workerThread: outcome,
  netFetch: outcome,
  netTcp: outcome,
  netUdp: outcome,
  netDns: outcome,
  codeGeneration: outcome,
  secretVisible: z.boolean(),
  envNames: z.array(z.string().max(128)).max(256),
  permissionModel: z.boolean(),
  nodeVersion: z.string().max(32),
  platform: z.string().max(32),
});

const parseResponse = z.union([
  z.strictObject({ ok: z.literal(true), result: parseResult }),
  z.strictObject({
    ok: z.literal(false),
    code: rejectCode,
    detail: z.string().max(200).nullable(),
  }),
]);

const probeResponse = z.strictObject({ ok: z.literal(true), probe: probeResult });

export type ValidPdfResult = z.infer<typeof pdfResult>;
export type ValidSheetResult = z.infer<typeof sheetResult>;
export type ValidImageResult = z.infer<typeof imageResult>;
export type ValidParseResult = z.infer<typeof parseResult>;
export type ValidProbeResult = z.infer<typeof probeResult>;
export type ValidParseResponse = z.infer<typeof parseResponse>;
export type ValidSandboxRejectCode = z.infer<typeof rejectCode>;

export class InvalidSandboxOutputError extends Error {
  constructor(why: string) {
    super(`invalid sandbox output: ${why}`);
    this.name = "InvalidSandboxOutputError";
  }
}

function paths(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.slice(0, 3).join(".") || "(root)"}:${i.code}`)
    .join(", ");
}

/** Schema + limit checks. Throws InvalidSandboxOutputError; never returns a partially trusted value. */
export function validateParseResponse(raw: unknown, limits: SandboxLimits): ValidParseResponse {
  const parsed = parseResponse.safeParse(raw);
  if (!parsed.success) throw new InvalidSandboxOutputError(paths(parsed.error));
  const response = parsed.data;
  if (!response.ok) return response;
  const r = response.result;
  switch (r.kind) {
    case "pdf": {
      if (r.pageCount > limits.maxPdfPages)
        throw new InvalidSandboxOutputError("page count over limit");
      if (r.pages.length !== r.pageCount)
        throw new InvalidSandboxOutputError("page list incomplete");
      let chars = 0;
      let items = 0;
      let itemChars = 0;
      r.pages.forEach((page, i) => {
        if (page.pageNo !== i + 1)
          throw new InvalidSandboxOutputError("page numbers not sequential");
        chars += page.text.length;
        items += page.items.length;
        for (const item of page.items) itemChars += item[4].length;
      });
      if (chars > limits.maxTextChars) throw new InvalidSandboxOutputError("text over limit");
      if (items > limits.maxLayoutItems) throw new InvalidSandboxOutputError("layout over limit");
      // positioned runs repeat the page text; they may not carry more of it than the text itself may hold
      if (itemChars > limits.maxTextChars)
        throw new InvalidSandboxOutputError("layout text over limit");
      break;
    }
    case "sheet": {
      if (r.sheets.length > limits.maxSheets)
        throw new InvalidSandboxOutputError("sheets over limit");
      if (r.cells.length > limits.maxCells) throw new InvalidSandboxOutputError("cells over limit");
      const names = new Set(r.sheets.map((s) => s.name));
      if (names.size !== r.sheets.length)
        throw new InvalidSandboxOutputError("duplicate sheet names");
      const seen = new Set<string>();
      let cellChars = 0;
      for (const cell of r.cells) {
        if (cell.s >= r.sheets.length) throw new InvalidSandboxOutputError("cell on unknown sheet");
        if (cell.v !== null && cell.v.length > limits.maxCellChars) {
          throw new InvalidSandboxOutputError("cell text over limit");
        }
        cellChars += cell.v?.length ?? 0;
        if (cellChars > limits.maxTextChars) {
          throw new InvalidSandboxOutputError("cell text total over limit");
        }
        if (cell.v === null && cell.f !== 1) throw new InvalidSandboxOutputError("empty cell");
        const anchor = `${cell.s}:${cell.r}:${cell.c}`;
        if (seen.has(anchor)) throw new InvalidSandboxOutputError("duplicate cell anchor");
        seen.add(anchor);
      }
      break;
    }
    case "image":
      if (r.width * r.height > limits.maxImagePixels) {
        throw new InvalidSandboxOutputError("image over pixel limit");
      }
      if (r.outputBytes > limits.maxOutputBytes) {
        throw new InvalidSandboxOutputError("image over size limit");
      }
      break;
  }
  return response;
}

export function validateProbeResponse(raw: unknown): ValidProbeResult {
  const parsed = probeResponse.safeParse(raw);
  if (!parsed.success) throw new InvalidSandboxOutputError(paths(parsed.error));
  return parsed.data.probe;
}
