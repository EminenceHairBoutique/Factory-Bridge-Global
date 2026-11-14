/**
 * Deterministic test doubles for the document pipeline: an in-memory object store and a scanner whose verdicts are
 * scripted. They exist so the pipeline's decisions can be tested without a storage service or an antivirus engine.
 * Neither is ever constructed outside tests (this directory is excluded from the build).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createConnection, createServer, type Server, type Socket } from "node:net";
import {
  ScannerUnavailableError,
  type MalwareScanner,
  type ScanVerdict,
  type ScannerUnavailableReason,
} from "../scanner.js";
import { ObjectNotFoundError, StorageUnavailableError, type ObjectStore } from "../storage.js";
import { FAKE_MALWARE_MARKER } from "./fixtures.js";

export class MemoryObjectStore implements ObjectStore {
  readonly objects = new Map<string, { data: Buffer; contentType: string }>();
  readonly downloads: string[] = [];
  readonly uploads: string[] = [];
  /** When set, the next download / upload fails as if storage were down. */
  failDownloads = 0;
  failUploads = 0;
  /** Invoked after a download completes (lets a test change state mid-pipeline). */
  afterDownload: (() => void | Promise<void>) | null = null;

  static key(bucket: string, objectPath: string): string {
    return `${bucket}/${objectPath}`;
  }

  put(
    bucket: string,
    objectPath: string,
    data: Buffer | string,
    contentType = "application/octet-stream",
  ): void {
    this.objects.set(MemoryObjectStore.key(bucket, objectPath), {
      data: typeof data === "string" ? Buffer.from(data, "utf8") : data,
      contentType,
    });
  }

  get(bucket: string, objectPath: string): Buffer | undefined {
    return this.objects.get(MemoryObjectStore.key(bucket, objectPath))?.data;
  }

  download(bucket: string, objectPath: string): Promise<AsyncIterable<Uint8Array>> {
    const key = MemoryObjectStore.key(bucket, objectPath);
    this.downloads.push(key);
    if (this.failDownloads > 0) {
      this.failDownloads--;
      return Promise.reject(new StorageUnavailableError("download status 503"));
    }
    const found = this.objects.get(key);
    if (found === undefined) return Promise.reject(new ObjectNotFoundError());
    const after = this.afterDownload;
    async function* chunks(): AsyncGenerator<Uint8Array> {
      for (let i = 0; i < found!.data.length; i += 16 * 1024) {
        yield found!.data.subarray(i, i + 16 * 1024);
      }
      await after?.();
    }
    return Promise.resolve(chunks());
  }

  async upload(
    bucket: string,
    objectPath: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    const key = MemoryObjectStore.key(bucket, objectPath);
    if (this.failUploads > 0) {
      this.failUploads--;
      throw new StorageUnavailableError("upload status 503");
    }
    this.uploads.push(key);
    this.objects.set(key, { data: await readFile(filePath), contentType });
  }

  /** Keys removed, in order. When failRemoves > 0 the next removal fails as if storage were down. */
  readonly removed: string[] = [];
  failRemoves = 0;

  remove(bucket: string, objectPath: string): Promise<void> {
    if (this.failRemoves > 0) {
      this.failRemoves--;
      return Promise.reject(new StorageUnavailableError("delete status 503"));
    }
    const key = MemoryObjectStore.key(bucket, objectPath);
    this.removed.push(key);
    this.objects.delete(key);
    return Promise.resolve();
  }
}

/**
 * A scripted scanner. By default it "detects" the harmless FAKE_MALWARE_MARKER and calls everything else clean;
 * `unavailable` makes the next N scans fail the way an unreachable or slow engine does.
 */
export class FakeScanner implements MalwareScanner {
  readonly name = "fake";
  readonly scanned: string[] = [];
  /** sha256 of every file this scanner was actually shown, in order. */
  readonly scannedHashes: string[] = [];
  unavailable: { times: number; reason: ScannerUnavailableReason } = {
    times: 0,
    reason: "unreachable",
  };

  /** 1-based number of the scan (counting successful ones) that reports "infected" whatever the file holds. */
  infectScan = 0;
  /** 1-based number of the scan attempt that fails as unreachable (once). */
  unavailableOnScan = 0;
  private attempts = 0;

  async scanFile(path: string, signal?: AbortSignal): Promise<ScanVerdict> {
    if (signal?.aborted === true) throw new ScannerUnavailableError("aborted");
    this.attempts++;
    if (this.unavailable.times > 0) {
      this.unavailable.times--;
      throw new ScannerUnavailableError(this.unavailable.reason);
    }
    if (this.attempts === this.unavailableOnScan) {
      this.unavailableOnScan = 0;
      throw new ScannerUnavailableError("unreachable");
    }
    this.scanned.push(path);
    const data = await readFile(path);
    this.scannedHashes.push(createHash("sha256").update(data).digest("hex"));
    return data.includes(FAKE_MALWARE_MARKER) || this.scanned.length === this.infectScan
      ? {
          verdict: "infected",
          engine: this.name,
          engineVersion: "fake/1",
          signature: "Fake.Test.Marker",
        }
      : { verdict: "clean", engine: this.name, engineVersion: "fake/1" };
  }
}

export type FakeClamdBehaviour =
  | "normal" // answers like clamd: OK, or FOUND for the marker
  | "error_reply" // answers "… ERROR"
  | "size_limit" // answers the INSTREAM size-limit error and hangs up
  | "garbage" // answers something that is not clamd's protocol
  | "early_ok" // answers "stream: OK" as soon as it sees INSTREAM, before any of the file has arrived
  | "hang" // accepts and never answers
  | "drop"; // closes the connection without answering

/**
 * A tiny TCP server speaking clamd's INSTREAM protocol, so ClamdScanner's wire handling (chunk framing, replies,
 * timeouts, disconnects) is tested without ClamAV. It is not a scanner: it looks for FAKE_MALWARE_MARKER only.
 */
export async function startFakeClamd(
  behaviour: FakeClamdBehaviour = "normal",
): Promise<{ port: number; received: () => Buffer; close: () => Promise<void>; server: Server }> {
  let received = Buffer.alloc(0);
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    let command: string | null = null;
    const body: Buffer[] = [];
    socket.on("error", () => undefined);
    socket.on("data", (chunk: Buffer) => {
      if (behaviour === "hang") return;
      if (behaviour === "drop") return void socket.destroy();
      buffer = Buffer.concat([buffer, chunk]);
      if (command === null) {
        const end = buffer.indexOf(0);
        if (end < 0) return;
        command = buffer.subarray(0, end).toString("latin1");
        buffer = buffer.subarray(end + 1);
        if (command === "zVERSION")
          return void socket.end("ClamAV 0.0.0/fake/Thu Jan  1 00:00:00 1970\0");
        if (command !== "zINSTREAM") return void socket.end("UNKNOWN COMMAND\0");
        if (behaviour === "size_limit")
          return void socket.end("INSTREAM size limit exceeded. ERROR\0");
        if (behaviour === "early_ok") return void socket.write("stream: OK\0");
      }
      for (;;) {
        if (buffer.length < 4) return;
        const length = buffer.readUInt32BE(0);
        if (length === 0) {
          received = Buffer.concat(body);
          if (behaviour === "error_reply")
            return void socket.end("stream: Can't allocate memory ERROR\0");
          if (behaviour === "garbage") return void socket.end("HTTP/1.1 400 Bad Request\r\n\r\n\0");
          return void socket.end(
            received.includes(FAKE_MALWARE_MARKER)
              ? "stream: Fake.Test.Marker FOUND\0"
              : "stream: OK\0",
          );
        }
        if (buffer.length < 4 + length) return;
        body.push(buffer.subarray(4, 4 + length));
        buffer = buffer.subarray(4 + length);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    port,
    server,
    received: () => received,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      }),
  };
}

/** A loopback port with nothing listening on it. */
export async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // make sure the OS has really released it before a test relies on a refusal
  await new Promise<void>((resolve) => {
    const probe = createConnection({ port, host: "127.0.0.1" });
    probe.on("error", () => resolve());
    probe.on("connect", () => {
      probe.destroy();
      resolve();
    });
  });
  return port;
}
