/** SupabaseObjectStore against a scripted fetch: request shape, error mapping, and that the key never leaks. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectNotFoundError, StorageUnavailableError, SupabaseObjectStore } from "./storage.js";

const KEY = "service-role-test-value";
const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const DOC = "bbbbbbbb-0000-4000-8000-000000000002";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer | null;
}

function scripted(respond: (call: Call) => Response | Promise<Response>): {
  fetch: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const impl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const chunks: Buffer[] = [];
    if (init?.body !== undefined && init.body !== null) {
      for await (const chunk of init.body as unknown as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
    }
    const call: Call = {
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: chunks.length > 0 ? Buffer.concat(chunks) : null,
    };
    calls.push(call);
    return respond(call);
  };
  return { fetch: impl, calls };
}

let dir: string;
let file: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fbg-storage-test-"));
  file = path.join(dir, "f.bin");
  writeFileSync(file, "promoted bytes");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function read(stream: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8");
}

describe("SupabaseObjectStore", () => {
  it("downloads with the service key and streams the body", async () => {
    const { fetch, calls } = scripted(() => new Response("file content"));
    const store = new SupabaseObjectStore({
      url: "http://127.0.0.1:54321/",
      serviceKey: KEY,
      fetch,
    });
    const body = await store.download("quarantine", `${ORG}/${DOC}/upload.bin`);
    expect(await read(body)).toBe("file content");
    expect(calls[0]).toMatchObject({
      url: `http://127.0.0.1:54321/storage/v1/object/quarantine/${ORG}/${DOC}/upload.bin`,
      method: "GET",
      headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
    });
  });

  it("uploads the file's bytes with upsert, so a retried promotion is idempotent", async () => {
    const { fetch, calls } = scripted(() => Response.json({ Key: "x" }));
    const store = new SupabaseObjectStore({
      url: "https://project.supabase.co",
      serviceKey: KEY,
      fetch,
    });
    await store.upload("documents", `${ORG}/${DOC}/abc-quote.pdf`, file, "application/pdf");
    expect(calls[0]).toMatchObject({
      url: `https://project.supabase.co/storage/v1/object/documents/${ORG}/${DOC}/abc-quote.pdf`,
      method: "POST",
      headers: { "content-type": "application/pdf", "content-length": "14", "x-upsert": "true" },
    });
    expect(calls[0]!.body?.toString()).toBe("promoted bytes");
  });

  it("removes an object, and treats one that is already gone as removed", async () => {
    const ok = scripted(() => Response.json({ message: "Successfully deleted" }));
    const store = new SupabaseObjectStore({
      url: "http://127.0.0.1:54321",
      serviceKey: KEY,
      fetch: ok.fetch,
    });
    await store.remove("quarantine", `${ORG}/${DOC}/upload.bin`);
    expect(ok.calls[0]).toMatchObject({
      url: `http://127.0.0.1:54321/storage/v1/object/quarantine/${ORG}/${DOC}/upload.bin`,
      method: "DELETE",
    });
    const gone = scripted(() =>
      Response.json({ statusCode: "404", error: "not_found", code: "NoSuchKey" }, { status: 400 }),
    );
    await expect(
      new SupabaseObjectStore({
        url: "http://127.0.0.1:54321",
        serviceKey: KEY,
        fetch: gone.fetch,
      }).remove("quarantine", "a/b/c"),
    ).resolves.toBeUndefined();
    const down = scripted(() => new Response("no", { status: 503 }));
    await expect(
      new SupabaseObjectStore({
        url: "http://127.0.0.1:54321",
        serviceKey: KEY,
        fetch: down.fetch,
      }).remove("quarantine", "a/b/c"),
    ).rejects.toBeInstanceOf(StorageUnavailableError);
  });

  it("maps a missing object, and nothing else, to ObjectNotFoundError", async () => {
    const store = (respond: () => Response) =>
      new SupabaseObjectStore({
        url: "http://localhost:54321",
        serviceKey: KEY,
        fetch: scripted(respond).fetch,
      });
    const missing = () =>
      Response.json(
        { statusCode: "404", error: "not_found", message: "Object not found", code: "NoSuchKey" },
        { status: 400 },
      );
    await expect(store(missing).download("quarantine", "a/b/c")).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
    // a bare 404 that is not storage-api's answer says nothing about the object
    await expect(
      store(() => new Response("x", { status: 404 })).download("quarantine", "a/b/c"),
    ).rejects.toBeInstanceOf(StorageUnavailableError);
    // a rejected key looks like a missing BUCKET: configuration, not a missing object
    const noBucket = () =>
      Response.json(
        { statusCode: "404", error: "Bucket not found", code: "NoSuchBucket" },
        { status: 400 },
      );
    await expect(store(noBucket).download("quarantine", "a/b/c")).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );
    for (const status of [401, 403, 429, 500, 503]) {
      const failing = () => new Response("no", { status });
      await expect(store(failing).download("quarantine", "a/b/c")).rejects.toBeInstanceOf(
        StorageUnavailableError,
      );
      await expect(
        store(failing).upload("documents", "a/b/c", file, "text/csv"),
      ).rejects.toBeInstanceOf(StorageUnavailableError);
    }
  });

  it("a network failure is 'unavailable', and no error ever contains the key or the URL", async () => {
    const boom = (() =>
      Promise.reject(new Error(`connect ECONNREFUSED with ${KEY}`))) as unknown as typeof fetch;
    const store = new SupabaseObjectStore({
      url: "http://127.0.0.1:1",
      serviceKey: KEY,
      fetch: boom,
    });
    for (const attempt of [
      store.download("quarantine", "a/b/c"),
      store.upload("documents", "a/b/c", file, "text/csv"),
    ]) {
      const err = (await attempt.catch((e: unknown) => e)) as Error;
      expect(err).toBeInstanceOf(StorageUnavailableError);
      expect(err.message).not.toContain(KEY);
      expect(err.message).not.toContain("127.0.0.1");
    }
  });

  it("refuses unsafe paths, bucket names and endpoints", async () => {
    const store = new SupabaseObjectStore({
      url: "http://127.0.0.1:54321",
      serviceKey: KEY,
      fetch: scripted(() => new Response("x")).fetch,
    });
    for (const bad of ["a/../b", "/a/b", "a//b", "a/./b", "a/b/"]) {
      await expect(store.download("quarantine", bad), bad).rejects.toThrow(/invalid object path/);
    }
    await expect(store.download("Quarantine/../x", "a")).rejects.toThrow(/invalid bucket/);
    expect(
      () => new SupabaseObjectStore({ url: "http://project.supabase.co", serviceKey: KEY }),
    ).toThrow(/https/);
    expect(() => new SupabaseObjectStore({ url: "ftp://127.0.0.1", serviceKey: KEY })).toThrow(
      /https/,
    );
    expect(() => new SupabaseObjectStore({ url: "nope", serviceKey: KEY })).toThrow(/valid URL/);
    expect(
      () => new SupabaseObjectStore({ url: "https://project.supabase.co", serviceKey: " " }),
    ).toThrow(/empty/);
  });
});
