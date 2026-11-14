/**
 * Streams one object to a private temporary file while hashing and counting it (B-13 step 1). The file is never
 * held in memory as a whole; the byte cap is enforced on what actually arrives, not on any declared length, and the
 * download stops the moment the cap is passed.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DocumentRejectedError, TransientDocumentError } from "./errors.js";

export interface IntakeResult {
  readonly bytes: number;
  /** Lower-case hex SHA-256 of exactly the bytes written. */
  readonly sha256: string;
}

/**
 * Writes `source` to `destination` (created exclusively, owner-only). Throws DocumentRejectedError("too_large")
 * when more than `maxBytes` arrive and TransientDocumentError when the stream or the disk fails.
 */
export async function streamToFile(
  source: AsyncIterable<Uint8Array>,
  destination: string,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<IntakeResult> {
  const hash = createHash("sha256");
  const out = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  let bytes = 0;
  let failure: Error | null = null;
  out.on("error", (err) => {
    failure ??= err;
  });
  try {
    for await (const chunk of source) {
      if (signal?.aborted === true) throw new TransientDocumentError("aborted");
      if (failure !== null)
        throw new TransientDocumentError("storage_unavailable", "temp file write");
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        throw new DocumentRejectedError("too_large", `more than ${maxBytes} bytes`);
      }
      hash.update(chunk);
      if (!out.write(chunk)) {
        await new Promise<void>((resolve) => {
          const done = (): void => {
            out.off("drain", done);
            out.off("error", done);
            resolve();
          };
          out.once("drain", done);
          out.once("error", done);
        });
      }
    }
  } catch (err) {
    out.destroy();
    if (err instanceof DocumentRejectedError || err instanceof TransientDocumentError) throw err;
    throw new TransientDocumentError("storage_unavailable", "download interrupted");
  }
  await new Promise<void>((resolve) => out.end(resolve));
  if (failure !== null) throw new TransientDocumentError("storage_unavailable", "temp file write");
  return { bytes, sha256: hash.digest("hex") };
}

export interface Workspace {
  readonly dir: string;
  /** The downloaded upload. Fixed name: nothing the uploader wrote ever becomes part of a local path. */
  readonly inputPath: string;
  /** Where the parser sandbox writes a re-encoded image. */
  readonly outputPath: string;
  dispose(): Promise<void>;
}

/** A fresh private directory for one job, removed (with everything in it) by dispose(). */
export async function createWorkspace(root: string = tmpdir()): Promise<Workspace> {
  const dir = await mkdtemp(path.join(root, "fbg-doc-"));
  return {
    dir,
    inputPath: path.join(dir, "input.bin"),
    outputPath: path.join(dir, "output.bin"),
    dispose: () => rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
  };
}
