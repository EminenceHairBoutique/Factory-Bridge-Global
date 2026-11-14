/**
 * Malware scanning (B-13): the interface, the ClamAV adapter, and the fail-closed default.
 *
 * The one rule every implementation obeys: a scanner returns a verdict (`clean` or `infected`) only when the engine
 * actually examined the bytes and said so. Unreachable, timed out, over its size limit, or answering anything this
 * code does not recognize → ScannerUnavailableError. "Could not scan" is never "clean", and there is no code path
 * that turns one into the other.
 *
 * ADR-009 has not chosen a scanner (ClamAV sidecar or a hosted API). ClamdScanner exists because ClamAV is free and
 * runs locally, which makes a real EICAR test possible; using it in a deployment is still a founder decision
 * (proposed ADR-043 in the session report). No hosted/paid scanner is implemented.
 */
import { createReadStream } from "node:fs";
import { connect, type Socket } from "node:net";

export type ScanVerdict =
  | { readonly verdict: "clean"; readonly engine: string; readonly engineVersion: string | null }
  | {
      readonly verdict: "infected";
      readonly engine: string;
      readonly engineVersion: string | null;
      /** The engine's signature name, reduced to a safe character set. */
      readonly signature: string;
    };

export type ScannerUnavailableReason =
  "not_configured" | "unreachable" | "timeout" | "aborted" | "size_limit" | "protocol";

export class ScannerUnavailableError extends Error {
  readonly reason: ScannerUnavailableReason;
  constructor(reason: ScannerUnavailableReason) {
    super(`scanner unavailable: ${reason}`);
    this.name = "ScannerUnavailableError";
    this.reason = reason;
  }
}

export interface MalwareScanner {
  readonly name: string;
  /** Scans the file at `path`. Resolves with a verdict or rejects with ScannerUnavailableError — nothing else. */
  scanFile(path: string, signal?: AbortSignal): Promise<ScanVerdict>;
}

/** The default when no scanner is configured: every scan fails closed. */
export class UnconfiguredScanner implements MalwareScanner {
  readonly name = "none";
  scanFile(): Promise<ScanVerdict> {
    return Promise.reject(new ScannerUnavailableError("not_configured"));
  }
}

export interface ClamdOptions {
  readonly host: string;
  readonly port: number;
  /** Whole-scan deadline (connect + stream + verdict). */
  readonly timeoutMs?: number;
}

const CHUNK = 64 * 1024;
const MAX_REPLY = 4096;

export function sanitizeSignature(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9._\-/:+() ]/g, "_").slice(0, 128);
  return cleaned === "" ? "unknown" : cleaned;
}

/** clamd's reply to INSTREAM, e.g. "stream: OK", "stream: Win.Test.EICAR_HDB-1 FOUND", "… ERROR". */
export function parseClamdReply(
  reply: string,
):
  | { verdict: "clean" }
  | { verdict: "infected"; signature: string }
  | { error: ScannerUnavailableReason } {
  const line = reply.replace(/\0+$/, "").trim();
  if (line === "stream: OK") return { verdict: "clean" };
  const found = /^stream: (.+) FOUND$/.exec(line);
  if (found !== null) return { verdict: "infected", signature: sanitizeSignature(found[1]!) };
  if (/size limit exceeded/i.test(line)) return { error: "size_limit" };
  return { error: "protocol" };
}

/**
 * ClamAV over clamd's TCP socket, using INSTREAM: the file is streamed to the daemon in length-prefixed chunks, so
 * the daemon needs no access to the worker's disk and the worker needs no ClamAV binaries.
 */
export class ClamdScanner implements MalwareScanner {
  readonly name = "clamav";
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(options: ClamdOptions) {
    if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
      throw new Error("clamd port must be 1-65535");
    }
    if (options.host.trim() === "") throw new Error("clamd host is empty");
    this.host = options.host;
    this.port = options.port;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  /**
   * One request/response exchange with the daemon; `send` writes the request and must end with clamd's terminator.
   * `early` is true when the reply was complete before the whole request had been written: the daemon answered
   * without having seen all of it, so whatever it said is not a verdict about the file.
   */
  private exchange(
    send: (socket: Socket) => Promise<void>,
    signal: AbortSignal | undefined,
  ): Promise<{ reply: string; early: boolean }> {
    return new Promise<{ reply: string; early: boolean }>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(new ScannerUnavailableError("aborted"));
        return;
      }
      const socket = connect({ host: this.host, port: this.port });
      const chunks: Buffer[] = [];
      let size = 0;
      let settled = false;
      let sent = false;
      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        socket.destroy();
        fn();
      };
      const fail = (reason: ScannerUnavailableReason): void =>
        settle(() => reject(new ScannerUnavailableError(reason)));
      const timer = setTimeout(() => fail("timeout"), this.timeoutMs);
      const onAbort = (): void => fail("aborted");
      signal?.addEventListener("abort", onAbort, { once: true });

      const maybeDone = (): boolean => {
        const reply = Buffer.concat(chunks);
        const end = reply.indexOf(0);
        if (end < 0) return false;
        const early = !sent;
        settle(() => resolve({ reply: reply.subarray(0, end).toString("latin1"), early }));
        return true;
      };
      socket.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_REPLY) return fail("protocol");
        chunks.push(chunk);
        maybeDone();
      });
      // A daemon that hangs up without a terminated reply did not give a verdict.
      socket.on("end", () => {
        if (!maybeDone()) fail(chunks.length === 0 ? "unreachable" : "protocol");
      });
      socket.on("close", () => fail("unreachable"));
      socket.on("error", () => {
        // clamd closes the socket when its stream limit is passed; the reply (if any) has already been read.
        if (!maybeDone()) fail("unreachable");
      });
      socket.on("connect", () => {
        send(socket).then(
          () => {
            sent = true;
          },
          () => {
            if (!maybeDone()) fail("unreachable");
          },
        );
      });
    });
  }

  /** "ClamAV 1.4.3/27820/Fri Nov 13 09:31:22 2026" — engine version / signature database version / its date. */
  async version(signal?: AbortSignal): Promise<string> {
    const { reply } = await this.exchange(async (socket) => {
      await write(socket, Buffer.from("zVERSION\0", "latin1"));
    }, signal);
    const line = reply.trim();
    if (!/^ClamAV \d/.test(line)) throw new ScannerUnavailableError("protocol");
    return sanitizeSignature(line);
  }

  async scanFile(path: string, signal?: AbortSignal): Promise<ScanVerdict> {
    // Asked first, so a verdict always records which engine and signature database produced it.
    const engineVersion = await this.version(signal);
    const { reply, early } = await this.exchange(async (socket) => {
      await write(socket, Buffer.from("zINSTREAM\0", "latin1"));
      const header = Buffer.alloc(4);
      for await (const chunk of createReadStream(path, { highWaterMark: CHUNK })) {
        const data = chunk as Buffer;
        header.writeUInt32BE(data.length, 0);
        await write(socket, Buffer.from(header));
        await write(socket, data);
      }
      await write(socket, Buffer.alloc(4)); // zero-length chunk: end of stream
    }, signal);
    const parsed = parseClamdReply(reply);
    if ("error" in parsed) throw new ScannerUnavailableError(parsed.error);
    // A verdict that arrived before the end-of-stream marker was written cannot be about the whole file.
    if (early) throw new ScannerUnavailableError("protocol");
    return parsed.verdict === "clean"
      ? { verdict: "clean", engine: this.name, engineVersion }
      : { verdict: "infected", engine: this.name, engineVersion, signature: parsed.signature };
  }
}

function write(socket: Socket, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.destroyed) {
      reject(new Error("socket closed"));
      return;
    }
    socket.write(data, (err) => (err ? reject(err) : resolve()));
  });
}
