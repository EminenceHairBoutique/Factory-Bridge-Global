/**
 * Containment probe (sandbox side): the child attempts each thing it must not be able to do and reports what
 * happened. The worker runs it before it will process a document (runner.ts → verifyContainment), and the test suite
 * runs it on every platform, so "the parser is contained" is a measured statement, not a description of flags.
 */
import type { ProbeOutcome, ProbeRequest, ProbeResult } from "./protocol.mts";

const DENIALS = new Set(["ERR_ACCESS_DENIED", "ERR_SANDBOX_DENIED"]);

/**
 * "denied" only when the attempt was refused by the permission model or by guard.mts. Any other failure — a
 * connection refused, a name not found, a timeout — means the attempt got as far as the outside world, which is
 * exactly what must not happen, so it counts as "allowed". An unclear result is never reported as contained.
 */
async function attempt(action: () => unknown): Promise<ProbeOutcome> {
  try {
    await action();
    return "allowed";
  } catch (err) {
    return DENIALS.has((err as { code?: string } | null)?.code ?? "") ? "denied" : "allowed";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("probe timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error("probe failed"));
      },
    );
  });
}

export async function runProbe(req: ProbeRequest): Promise<ProbeResult> {
  const fs = await import("node:fs");
  const fsRead = await attempt(() => fs.readFileSync(req.forbiddenReadPath));
  const fsWrite = await attempt(() => fs.writeFileSync(req.forbiddenWritePath, "x"));
  const childProcess = await attempt(async () => {
    const cp = await import("node:child_process");
    cp.execFileSync(process.execPath, ["--version"]);
  });
  const workerThread = await attempt(async () => {
    const wt = await import("node:worker_threads");
    const worker = new wt.Worker("0", { eval: true });
    await worker.terminate();
  });
  const url = `http://127.0.0.1:${req.tcpPort}/`;
  const netFetch = await attempt(() => withTimeout(Promise.resolve(fetch(url)), 2_000));
  const netTcp = await attempt(async () => {
    const net = await import("node:net");
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const socket = net.connect(req.tcpPort, "127.0.0.1");
        socket.once("connect", () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", reject);
      }),
      2_000,
    );
  });
  const netUdp = await attempt(async () => {
    const dgram = await import("node:dgram");
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const socket = dgram.createSocket("udp4");
        socket.once("error", reject);
        socket.send("x", req.tcpPort, "127.0.0.1", (err) => {
          socket.close();
          if (err) reject(err);
          else resolve();
        });
      }),
      2_000,
    );
  });
  // Name resolution counts as denied only if every way of asking is: the lookup, the callback resolvers, and a
  // fresh Resolver of each API (a different class from the module-level functions).
  const dnsAttempts = await Promise.all([
    attempt(async () => {
      const dns = await import("node:dns");
      await withTimeout(dns.promises.lookup("localhost"), 2_000);
    }),
    attempt(async () => {
      const dns = await import("node:dns");
      await withTimeout(new dns.promises.Resolver().resolve4("localhost"), 2_000);
    }),
    attempt(async () => {
      const dns = await import("node:dns");
      await withTimeout(new dns.promises.Resolver().resolveTxt("localhost"), 2_000);
    }),
    attempt(async () => {
      const dns = await import("node:dns");
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          new dns.Resolver().resolveSoa("localhost", (err) => (err ? reject(err) : resolve()));
        }),
        2_000,
      );
    }),
    attempt(async () => {
      const dns = await import("node:dns");
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          dns.resolveCaa("localhost", (err) => (err ? reject(err) : resolve()));
        }),
        2_000,
      );
    }),
  ]);
  const netDns: ProbeOutcome = dnsAttempts.every((o) => o === "denied") ? "denied" : "allowed";
  // V8 refuses code generation with a plain EvalError (no error code), so this check is its own shape.
  let codeGeneration: ProbeOutcome = "allowed";
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the probe's whole point
    new Function("return 1")();
  } catch (err) {
    if (err instanceof EvalError) codeGeneration = "denied";
  }

  const envNames = Object.keys(process.env).sort();
  const secretVisible =
    process.env[req.secretEnvName] !== undefined ||
    envNames.some((name) => /KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|SUPABASE/i.test(name));

  return {
    fsRead,
    fsWrite,
    childProcess,
    workerThread,
    netFetch,
    netTcp,
    netUdp,
    netDns,
    codeGeneration,
    secretVisible,
    envNames,
    permissionModel: typeof process.permission?.has === "function",
    nodeVersion: process.version,
    platform: process.platform,
  };
}
