/**
 * PDF → page text and positioned text runs (sandbox side), with pdf.js.
 *
 * What is switched off, and why it holds:
 *  - JavaScript in the PDF is never run. pdf.js only executes document scripts through its separate scripting
 *    sandbox (pdf.sandbox.mjs), which this code never loads; scripts are merely detected and flagged.
 *  - No code generation: `isEvalSupported: false`, and the process runs with --disallow-code-generation-from-strings.
 *  - XFA forms, system fonts, font-face loading and worker-side fetching are disabled; nothing is rendered.
 *  - The only files pdf.js reads are its own CMaps and standard-font metrics, from the package directory it is given.
 *  - Errors stop the parse (`stopAtErrors`): a damaged file is refused rather than partially read as if complete.
 */
import { readFileSync } from "node:fs";
import {
  SandboxReject,
  type PdfPage,
  type PdfResult,
  type PdfTextItem,
  type SandboxLimits,
  type SandboxModules,
} from "./protocol.mts";

interface PdfTextContentItem {
  readonly str?: string;
  readonly transform?: readonly number[];
  readonly width?: number;
  readonly height?: number;
  readonly hasEOL?: boolean;
}

interface PdfPageProxy {
  readonly view: readonly number[];
  readonly rotate: number;
  getTextContent(): Promise<{ items: readonly PdfTextContentItem[] }>;
  cleanup(): void;
}

interface PdfDocumentProxy {
  readonly numPages: number;
  getPage(n: number): Promise<PdfPageProxy>;
  getJSActions(): Promise<unknown>;
  getAttachments(): Promise<unknown>;
}

interface PdfLoadingTask {
  readonly promise: Promise<PdfDocumentProxy>;
  destroy(): Promise<void>;
}

interface PdfJsModule {
  getDocument(params: Record<string, unknown>): PdfLoadingTask;
}

/**
 * Two decimals. A coordinate that is not a finite number (a PDF can write a 400-digit operand) is a property of
 * the file, so it is refused here as corrupt rather than serialized as `null` and bounced by the parent's schema.
 */
const round = (n: number): number => {
  if (!Number.isFinite(n)) throw new SandboxReject("corrupt_file", "non-finite page geometry");
  return Math.round(n * 100) / 100;
};

function rejectionFor(err: unknown): SandboxReject {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "PasswordException") return new SandboxReject("encrypted_file");
  return new SandboxReject("corrupt_file", "pdf could not be read");
}

export async function parsePdfFile(
  path: string,
  limits: SandboxLimits,
  modules: SandboxModules,
): Promise<PdfResult> {
  if (modules.pdfjsUrl === null || modules.pdfjsDir === null) {
    throw new Error("pdf parser module was not provided");
  }
  const pdfjs = (await import(modules.pdfjsUrl)) as PdfJsModule;
  const data = new Uint8Array(readFileSync(path));

  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    enableXfa: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    stopAtErrors: true,
    verbosity: 0,
    cMapUrl: `${modules.pdfjsDir}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${modules.pdfjsDir}standard_fonts/`,
  });

  let doc: PdfDocumentProxy;
  try {
    doc = await task.promise;
  } catch (err) {
    throw rejectionFor(err);
  }

  try {
    if (doc.numPages > limits.maxPdfPages) {
      throw new SandboxReject(
        "too_many_pages",
        `${doc.numPages} pages, limit ${limits.maxPdfPages}`,
      );
    }
    if (doc.numPages < 1) throw new SandboxReject("corrupt_file", "pdf has no pages");

    const flags = new Set<string>();
    const pages: PdfPage[] = [];
    let totalChars = 0;
    let totalItems = 0;

    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      let page: PdfPageProxy;
      let content: { items: readonly PdfTextContentItem[] };
      try {
        page = await doc.getPage(pageNo);
        content = await page.getTextContent();
      } catch (err) {
        throw rejectionFor(err);
      }
      let text = "";
      const items: PdfTextItem[] = [];
      let itemsTruncated = false;
      for (const item of content.items) {
        if (typeof item.str !== "string") continue; // marked-content markers
        const str = item.str.includes("\u0000") ? item.str.replaceAll("\u0000", "") : item.str;
        text += str;
        if (item.hasEOL === true) text += "\n";
        if (str.trim() === "") continue;
        if (totalItems >= limits.maxLayoutItems) {
          itemsTruncated = true;
          continue;
        }
        const tr = item.transform ?? [];
        items.push([
          round(tr[4] ?? 0),
          round(tr[5] ?? 0),
          round(item.width ?? 0),
          round(item.height ?? 0),
          str,
        ]);
        totalItems++;
      }
      totalChars += text.length;
      if (totalChars > limits.maxTextChars) {
        throw new SandboxReject(
          "output_too_large",
          `more than ${limits.maxTextChars} characters of text`,
        );
      }
      if (itemsTruncated) flags.add("layout_truncated");
      const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view;
      pages.push({
        pageNo,
        width: round(x1 - x0),
        height: round(y1 - y0),
        rotation: Number.isInteger(page.rotate) ? ((page.rotate % 360) + 360) % 360 : 0,
        text,
        items,
        itemsTruncated,
      });
      page.cleanup();
    }

    if (pages.every((p) => p.text.trim() === "")) flags.add("no_text_layer");
    try {
      const actions = await doc.getJSActions();
      if (actions !== null && actions !== undefined) flags.add("javascript_present_not_executed");
    } catch {
      // detection only; a failure here says nothing about the text that was read
    }
    try {
      const attachments = await doc.getAttachments();
      if (attachments !== null && attachments !== undefined) flags.add("attachments_ignored");
    } catch {
      // detection only
    }
    return { kind: "pdf", pageCount: doc.numPages, pages, flags: [...flags].sort() };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
