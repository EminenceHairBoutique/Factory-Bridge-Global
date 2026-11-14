/**
 * Object storage as the document pipeline needs it: read one object from quarantine, write one object to a served
 * bucket. Behind an interface so the pipeline is unit-tested without a storage service and integration-tested
 * against the real one (Supabase Storage on the local stack).
 *
 * The worker talks to storage with the service-role key, so no storage policy protects one organization's objects
 * from a wrong path here. Callers therefore never pass a path taken from a queue message: the handler derives it
 * from the document row and checks it is bound to that row's organization and id (filename.ts isBoundStoragePath).
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("object not found");
    this.name = "ObjectNotFoundError";
  }
}

/** Storage could not answer (network, 5xx, auth, timeout). Carries a status class, never a URL, key or body. */
export class StorageUnavailableError extends Error {
  constructor(what: string) {
    super(`storage unavailable: ${what}`);
    this.name = "StorageUnavailableError";
  }
}

export interface ObjectStore {
  /** Streams the object. Throws ObjectNotFoundError or StorageUnavailableError. */
  download(
    bucket: string,
    objectPath: string,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<Uint8Array>>;
  /**
   * Writes the file at `filePath` as the object, replacing an existing one (so a retried job is idempotent).
   * Throws StorageUnavailableError.
   */
  upload(
    bucket: string,
    objectPath: string,
    filePath: string,
    contentType: string,
    signal?: AbortSignal,
  ): Promise<void>;
  /** Deletes the object. An object that is already gone is success. Throws StorageUnavailableError. */
  remove(bucket: string, objectPath: string, signal?: AbortSignal): Promise<void>;
}

const BUCKET = /^[a-z0-9][a-z0-9-]{1,62}$/;

function objectUrl(base: string, bucket: string, objectPath: string): string {
  if (!BUCKET.test(bucket)) throw new Error("invalid bucket name");
  const segments = objectPath.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    throw new Error("invalid object path");
  }
  return `${base}/storage/v1/object/${bucket}/${segments.map(encodeURIComponent).join("/")}`;
}

export interface SupabaseObjectStoreOptions {
  /** Project URL, e.g. http://127.0.0.1:54321 locally. https is required for anything but a loopback host. */
  readonly url: string;
  /** Service-role (secret) key. Held in memory only; never logged, never put in an error. */
  readonly serviceKey: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export class SupabaseObjectStore implements ObjectStore {
  private readonly base: string;
  private readonly headers: Readonly<Record<string, string>>;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseObjectStoreOptions) {
    let parsed: URL;
    try {
      parsed = new URL(options.url);
    } catch {
      throw new Error("storage URL is not a valid URL");
    }
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && LOOPBACK.has(parsed.hostname))
    ) {
      throw new Error("storage URL must be https (http is allowed for a loopback host only)");
    }
    if (options.serviceKey.trim() === "") throw new Error("storage service key is empty");
    this.base = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
    this.headers = { apikey: options.serviceKey, authorization: `Bearer ${options.serviceKey}` };
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private signal(signal: AbortSignal | undefined): AbortSignal {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
  }

  async download(
    bucket: string,
    objectPath: string,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<Uint8Array>> {
    const target = objectUrl(this.base, bucket, objectPath); // a bad path is a bug, not an outage: it throws as itself
    let res: Response;
    try {
      res = await this.fetchImpl(target, {
        method: "GET",
        headers: this.headers,
        signal: this.signal(signal),
        redirect: "error",
      });
    } catch {
      throw new StorageUnavailableError("download request failed");
    }
    if ((res.status === 404 || res.status === 400) && (await isNotFoundBody(res))) {
      await res.body?.cancel().catch(() => undefined);
      throw new ObjectNotFoundError();
    }
    if (!res.ok || res.body === null) {
      await res.body?.cancel().catch(() => undefined);
      throw new StorageUnavailableError(`download status ${res.status}`);
    }
    return res.body;
  }

  async upload(
    bucket: string,
    objectPath: string,
    filePath: string,
    contentType: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const target = objectUrl(this.base, bucket, objectPath);
    const { size } = await stat(filePath);
    const body = Readable.toWeb(createReadStream(filePath)) as unknown as NonNullable<
      RequestInit["body"]
    >;
    let res: Response;
    try {
      res = await this.fetchImpl(target, {
        method: "POST",
        headers: {
          ...this.headers,
          "content-type": contentType,
          "content-length": String(size),
          "cache-control": "max-age=3600",
          "x-upsert": "true",
        },
        body,
        duplex: "half",
        signal: this.signal(signal),
        redirect: "error",
      });
    } catch {
      throw new StorageUnavailableError("upload request failed");
    }
    await res.body?.cancel().catch(() => undefined);
    if (!res.ok) throw new StorageUnavailableError(`upload status ${res.status}`);
  }

  async remove(bucket: string, objectPath: string, signal?: AbortSignal): Promise<void> {
    const target = objectUrl(this.base, bucket, objectPath);
    let res: Response;
    try {
      res = await this.fetchImpl(target, {
        method: "DELETE",
        headers: this.headers,
        signal: this.signal(signal),
        redirect: "error",
      });
    } catch {
      throw new StorageUnavailableError("delete request failed");
    }
    const gone = !res.ok && (await isNotFoundBody(res));
    await res.body?.cancel().catch(() => undefined);
    if (!res.ok && !gone) throw new StorageUnavailableError(`delete status ${res.status}`);
  }
}

/**
 * storage-api answers a missing object with HTTP 400 and `{ statusCode: "404", error: "not_found", code: "NoSuchKey" }`
 * (measured on v1.90.1). A missing BUCKET — which is also what a rejected key looks like — has the same status but a
 * different code; that is a configuration problem, not a missing object, and stays "unavailable".
 */
async function isNotFoundBody(res: Response): Promise<boolean> {
  try {
    const body = (await res.clone().json()) as { error?: unknown; code?: unknown };
    return body.code === "NoSuchKey" || body.error === "not_found";
  } catch {
    return false;
  }
}
