/**
 * Runs the parser sandbox (B-12): one short-lived Node process per document, started with
 *
 *   --permission                              Node's permission model on
 *   --allow-fs-read=<sandbox sources>         the parser code itself
 *   --allow-fs-read=<parser library>          pdf.js (pure JS)  — or, for images only, node_modules (sharp + libvips)
 *   --allow-fs-read=<the one input file>
 *   --allow-addons                            images only: libvips is native code
 *   --disallow-code-generation-from-strings   no eval / new Function
 *   --max-old-space-size=<n>                  V8 heap ceiling
 *
 * with an EMPTY environment (no database URL, no storage key, no API key), no inherited file descriptors besides the
 * three pipes, a wall-clock kill, a bounded stdout, and guard.mts closing the network inside the process. No
 * `--allow-fs-write`, `--allow-child-process`, `--allow-worker` or `--allow-wasi` is ever passed.
 *
 * ISOLATION LEVEL — read before relying on this. This is process-level containment enforced by the Node runtime.
 * It is not an operating-system sandbox: there is no network namespace, no seccomp filter, no cgroup memory limit,
 * and native code (libvips, loaded for images) is outside Node's permission model entirely. `verifyContainment()`
 * measures what actually holds on the machine it runs on; config.ts refuses to enable document processing outside
 * development until an OS-level boundary exists (docs/reports/2026-11-14_B12_B13_SECURE_DOCUMENT_PIPELINE_REPORT.md §3).
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_PARSER_HEAP_MB, DEFAULT_SANDBOX_LIMITS } from "./limits.js";
import {
  InvalidSandboxOutputError,
  validateParseResponse,
  validateProbeResponse,
  type ValidParseResponse,
  type ValidProbeResult,
} from "./results.js";
import type {
  ParseKind,
  SandboxLimits,
  SandboxModules,
  SandboxRequest,
} from "./sandbox/protocol.mts";

export type SandboxFailureReason =
  "spawn_failed" | "timeout" | "aborted" | "crashed" | "output_too_large" | "output_invalid";

/** The sandbox did not complete its protocol. Says nothing about the file: callers retry, they do not reject. */
export class SandboxFailure extends Error {
  readonly reason: SandboxFailureReason;
  /** Exit code or signal only — never the child's output. */
  readonly exit: string | null;
  constructor(reason: SandboxFailureReason, exit: string | null = null) {
    super(exit === null ? `sandbox ${reason}` : `sandbox ${reason} (${exit})`);
    this.name = "SandboxFailure";
    this.reason = reason;
    this.exit = exit;
  }
}

export interface ParserSandbox {
  /** "process" = Node permission model + runtime guard. No OS-level tier exists yet. */
  readonly isolation: "process";
  parse(
    kind: ParseKind,
    inputPath: string,
    outputPath: string | null,
    signal?: AbortSignal,
  ): Promise<ValidParseResponse>;
  probe(signal?: AbortSignal): Promise<ValidProbeResult>;
}

export interface ProcessSandboxOptions {
  readonly limits?: SandboxLimits;
  readonly timeoutMs?: number;
  readonly heapMb?: number;
  /** Ceiling on the child's stdout; a child that writes more is killed. */
  readonly maxStdoutBytes?: number;
  /** Test hook: run this file (inside the sandbox directory) instead of child.mts. */
  readonly entryFile?: string;
}

interface ResolvedPaths {
  readonly sandboxDir: string;
  readonly entry: string;
  readonly stripTypes: boolean;
  readonly pdfjsMain: string;
  readonly pdfjsDir: string;
  readonly sharpMain: string;
  readonly sharpReadRoot: string;
}

function real(p: string): string {
  return realpathSync.native(p);
}

function resolvePaths(entryFile: string | undefined): ResolvedPaths {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sandboxDir = real(path.join(here, "sandbox"));
  // Sources (.mts, development and tests) or their compiled form (.mjs, a build): whichever is on disk.
  const sourceEntry = path.join(sandboxDir, entryFile ?? "child.mts");
  const builtEntry = sourceEntry.replace(/\.mts$/, ".mjs");
  const stripTypes = existsSync(sourceEntry) && sourceEntry.endsWith(".mts");
  const entry = stripTypes ? sourceEntry : builtEntry;
  if (!existsSync(entry)) throw new SandboxFailure("spawn_failed", "entry_missing");

  const require = createRequire(import.meta.url);
  const pdfjsMain = real(require.resolve("pdfjs-dist/legacy/build/pdf.mjs"));
  const pdfjsDir = path.resolve(path.dirname(pdfjsMain), "..", "..");
  const sharpMain = real(require.resolve("sharp"));
  const marker = `${path.sep}node_modules${path.sep}`;
  const at = sharpMain.indexOf(marker);
  if (at < 0) throw new SandboxFailure("spawn_failed", "sharp_outside_node_modules");
  const sharpReadRoot = sharpMain.slice(0, at + marker.length - 1);
  return { sandboxDir, entry, stripTypes, pdfjsMain, pdfjsDir, sharpMain, sharpReadRoot };
}

const isImage = (kind: ParseKind): boolean => kind === "jpeg" || kind === "png" || kind === "webp";

export class ProcessSandbox implements ParserSandbox {
  readonly isolation = "process" as const;
  private readonly limits: SandboxLimits;
  private readonly timeoutMs: number;
  private readonly heapMb: number;
  private readonly maxStdoutBytes: number;
  private readonly entryFile: string | undefined;
  private paths: ResolvedPaths | null = null;

  constructor(options: ProcessSandboxOptions = {}) {
    this.limits = options.limits ?? DEFAULT_SANDBOX_LIMITS;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.heapMb = options.heapMb ?? DEFAULT_PARSER_HEAP_MB;
    this.maxStdoutBytes = options.maxStdoutBytes ?? 96 * 1024 * 1024;
    this.entryFile = options.entryFile;
  }

  private resolved(): ResolvedPaths {
    this.paths ??= resolvePaths(this.entryFile);
    return this.paths;
  }

  async parse(
    kind: ParseKind,
    inputPath: string,
    outputPath: string | null,
    signal?: AbortSignal,
  ): Promise<ValidParseResponse> {
    const p = this.resolved();
    const input = real(inputPath);
    const image = isImage(kind);
    if (image !== (outputPath !== null)) {
      throw new Error("an output path is required for images and only for images");
    }
    const modules: SandboxModules = {
      pdfjsUrl: kind === "pdf" ? pathToFileURL(p.pdfjsMain).href : null,
      pdfjsDir: kind === "pdf" ? `${p.pdfjsDir}${path.sep}` : null,
      sharpUrl: image ? pathToFileURL(p.sharpMain).href : null,
    };
    const reads = [input];
    if (kind === "pdf") reads.push(`${p.pdfjsDir}${path.sep}*`);
    if (image) reads.push(`${p.sharpReadRoot}${path.sep}*`);
    const raw = await this.run(
      { op: "parse", kind, inputPath: input, outputPath, limits: this.limits, modules },
      reads,
      image,
      signal,
    );
    let response: ValidParseResponse;
    try {
      response = validateParseResponse(raw, this.limits);
    } catch (err) {
      if (err instanceof InvalidSandboxOutputError) throw new SandboxFailure("output_invalid");
      throw err;
    }
    // A well-formed answer to a different question is still not an answer: a PDF job must come back as a PDF.
    if (response.ok) {
      const r = response.result;
      const matches =
        kind === "pdf"
          ? r.kind === "pdf"
          : kind === "xlsx" || kind === "csv"
            ? r.kind === "sheet" && r.format === kind
            : r.kind === "image" && r.format === kind;
      if (!matches) throw new SandboxFailure("output_invalid");
    }
    return response;
  }

  /**
   * Runs the containment probe: the child tries to read a file outside its allow-list, write a file, start a
   * process and a thread, reach a listening loopback port four ways, generate code, and see a parent secret.
   */
  async probe(signal?: AbortSignal): Promise<ValidProbeResult> {
    const secretEnvName = `FBG_PROBE_SECRET_${randomBytes(4).toString("hex").toUpperCase()}`;
    const server = createServer((socket) => socket.destroy());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const tcpPort = typeof address === "object" && address !== null ? address.port : 0;
    process.env[secretEnvName] = "probe";
    try {
      const raw = await this.run(
        {
          op: "probe",
          // This very file sits outside the sandbox directory: a correct allow-list cannot read it.
          forbiddenReadPath: fileURLToPath(import.meta.url),
          forbiddenWritePath: path.join(
            real(tmpdir()),
            `fbg-probe-${randomBytes(6).toString("hex")}`,
          ),
          tcpPort,
          secretEnvName,
        },
        [],
        false,
        signal,
      );
      try {
        return validateProbeResponse(raw);
      } catch (err) {
        if (err instanceof InvalidSandboxOutputError) throw new SandboxFailure("output_invalid");
        throw err;
      }
    } finally {
      delete process.env[secretEnvName];
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  private run(
    request: SandboxRequest,
    extraReads: readonly string[],
    allowAddons: boolean,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    const p = this.resolved();
    const args = [
      "--permission",
      `--allow-fs-read=${p.sandboxDir}${path.sep}*`,
      ...extraReads.map((r) => `--allow-fs-read=${r}`),
      ...(allowAddons ? ["--allow-addons"] : []),
      "--disallow-code-generation-from-strings",
      `--max-old-space-size=${this.heapMb}`,
      "--no-warnings",
      ...(p.stripTypes ? ["--experimental-strip-types"] : []),
      p.entry,
    ];

    return new Promise<unknown>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(new SandboxFailure("aborted"));
        return;
      }
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(process.execPath, args, {
          env: {}, // nothing of the worker's environment: no credentials can leak into the parser
          cwd: p.sandboxDir,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
          shell: false,
        });
      } catch {
        reject(new SandboxFailure("spawn_failed"));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let settled = false;
      let failure: SandboxFailure | null = null;

      const kill = (why: SandboxFailure): void => {
        failure ??= why;
        child.kill("SIGKILL");
      };
      const timer = setTimeout(() => kill(new SandboxFailure("timeout")), this.timeoutMs);
      const onAbort = (): void => kill(new SandboxFailure("aborted"));
      signal?.addEventListener("abort", onAbort, { once: true });
      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        fn();
      };

      child.stdout?.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxStdoutBytes) kill(new SandboxFailure("output_too_large"));
        else chunks.push(chunk);
      });
      child.stderr?.resume(); // drained and discarded: it may quote the file
      child.stdin?.on("error", () => undefined); // the child may exit before reading
      child.on("error", () => finish(() => reject(new SandboxFailure("spawn_failed"))));
      const conclude = (code: number | null, sig: NodeJS.Signals | null): void => {
        finish(() => {
          if (failure !== null) return reject(failure);
          if (code !== 0) {
            return reject(new SandboxFailure("crashed", sig ?? `exit ${String(code)}`));
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new SandboxFailure("output_invalid"));
          }
        });
      };
      child.on("close", conclude);
      // `close` waits for the pipes; if something else were still holding them open after the process is gone,
      // it would never come. Give the pipes a moment to drain, then cut them and settle anyway.
      child.on("exit", (code, sig) => {
        const grace = setTimeout(() => {
          child.stdout?.destroy();
          child.stderr?.destroy();
          conclude(code, sig);
        }, 2_000);
        grace.unref();
      });
      child.stdin?.end(JSON.stringify(request));
    });
  }
}

export interface ContainmentReport {
  readonly contained: boolean;
  /** Names of the checks that were NOT denied. Empty when contained. */
  readonly breaches: readonly string[];
  readonly probe: ValidProbeResult;
}

/** Every check must come back denied, the permission model must be on, and no secret may be visible. */
export function assessContainment(probe: ValidProbeResult): ContainmentReport {
  const breaches: string[] = [];
  const checks = [
    "fsRead",
    "fsWrite",
    "childProcess",
    "workerThread",
    "netFetch",
    "netTcp",
    "netUdp",
    "netDns",
    "codeGeneration",
  ] as const;
  for (const check of checks) if (probe[check] !== "denied") breaches.push(check);
  if (!probe.permissionModel) breaches.push("permissionModel");
  if (probe.secretVisible) breaches.push("secretVisible");
  return { contained: breaches.length === 0, breaches, probe };
}

export async function verifyContainment(
  sandbox: ParserSandbox,
  signal?: AbortSignal,
): Promise<ContainmentReport> {
  return assessContainment(await sandbox.probe(signal));
}
