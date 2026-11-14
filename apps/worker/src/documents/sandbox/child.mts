/**
 * Entry point of the parser sandbox process (B-12). One request on stdin (JSON), one response on stdout (JSON), exit.
 *
 * Exit code 0 means the protocol completed: the file was parsed, or the parser refused it with a code. Any other exit
 * (an unexpected exception, a kill for time or memory) is a crash, which the worker treats as an infrastructure
 * failure and never as a verdict about the file.
 */
import { installSandboxGuard } from "./guard.mts";
import {
  SANDBOX_EXIT_OK,
  SandboxReject,
  type ParseRequest,
  type ParseResult,
  type SandboxRequest,
  type SandboxResponse,
} from "./protocol.mts";

installSandboxGuard();

const MAX_REQUEST_BYTES = 64 * 1024;

async function readRequest(): Promise<SandboxRequest> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("sandbox request too large");
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as SandboxRequest;
}

async function parse(req: ParseRequest): Promise<ParseResult> {
  const { statSync } = await import("node:fs");
  const size = statSync(req.inputPath).size;
  if (size > req.limits.maxInputBytes) throw new SandboxReject("too_large", `${size} bytes`);
  switch (req.kind) {
    case "pdf":
      return (await import("./pdf.mts")).parsePdfFile(req.inputPath, req.limits, req.modules);
    case "xlsx":
      return (await import("./xlsx.mts")).parseXlsxFile(req.inputPath, req.limits);
    case "csv":
      return (await import("./csv.mts")).parseCsvFile(req.inputPath, req.limits);
    case "jpeg":
    case "png":
    case "webp":
      return (await import("./image.mts")).reencodeImageFile(
        req.inputPath,
        req.outputPath,
        req.kind,
        req.limits,
        req.modules,
      );
  }
}

function write(json: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(json, (err) => (err ? reject(err) : resolve()));
  });
}

const send = (response: SandboxResponse): Promise<void> => write(JSON.stringify(response));

/**
 * Serializes a result, refusing one that is too large to hand back. How big a result gets is decided by the file
 * (a small workbook can repeat one long string in thousands of cells), so "too large" is a verdict about the file —
 * `output_too_large` — and not a crash that would be retried for nothing.
 */
function encodeResult(result: ParseResult, maxChars: number): string {
  let json: string;
  try {
    json = JSON.stringify({ ok: true, result } satisfies SandboxResponse);
  } catch {
    throw new SandboxReject("output_too_large", "result cannot be serialized");
  }
  if (json.length > maxChars) {
    throw new SandboxReject("output_too_large", `response larger than ${maxChars} characters`);
  }
  return json;
}

try {
  const req = await readRequest();
  if (req.op === "probe") {
    await send({ ok: true, probe: await (await import("./probe.mts")).runProbe(req) });
  } else if (req.op === "parse") {
    let json: string;
    try {
      json = encodeResult(await parse(req), req.limits.maxResponseChars);
    } catch (err) {
      if (!(err instanceof SandboxReject)) throw err;
      json = JSON.stringify({
        ok: false,
        code: err.code,
        detail: err.detail,
      } satisfies SandboxResponse);
    }
    await write(json);
  } else {
    throw new Error("unknown sandbox operation");
  }
  process.exitCode = SANDBOX_EXIT_OK;
} catch {
  // Nothing about the failure is written anywhere: the message could quote the file.
  process.exitCode = 70;
}
