/**
 * Runtime guard installed first thing in the sandbox process, before any parser library is loaded.
 *
 * Node's permission model (the flags runner.ts starts this process with) denies file access outside an allow-list,
 * child processes, worker threads and — unless asked — native addons. On the Node versions this repository supports
 * it has no network permission, so the network is closed here instead: every socket-opening entry point of the
 * runtime is replaced with a function that throws.
 *
 * This is a seat belt, not a jail. It stops a parser library that is talked into fetching a URL (the realistic
 * failure) and is verified by the containment probe on every platform. It does not stop native code or an engine
 * exploit; only an operating-system boundary does (network namespace / container), and the worker refuses to enable
 * document processing outside development until one exists.
 */
import { syncBuiltinESMExports } from "node:module";

function deny(what: string): () => never {
  return () => {
    const err = new Error(`${what} is disabled in the parser sandbox`);
    (err as Error & { code: string }).code = "ERR_SANDBOX_DENIED";
    throw err;
  };
}

type Patchable = Record<string, unknown>;

function patch(target: unknown, names: readonly string[], what: string): void {
  if (target === null || target === undefined) return;
  for (const name of names) {
    try {
      Object.defineProperty(target as Patchable, name, {
        value: deny(what),
        writable: false,
        configurable: false,
      });
    } catch {
      // a property that cannot be redefined is reported by the probe, not hidden here
    }
  }
}

export function installSandboxGuard(): void {
  const builtin = (id: string): Patchable | undefined => {
    try {
      return process.getBuiltinModule(id) as Patchable | undefined;
    } catch {
      return undefined;
    }
  };

  const net = builtin("node:net");
  if (net !== undefined) {
    patch(
      (net["Socket"] as { prototype?: unknown } | undefined)?.prototype,
      ["connect"],
      "network access",
    );
    patch(
      (net["Server"] as { prototype?: unknown } | undefined)?.prototype,
      ["listen"],
      "network access",
    );
    patch(net, ["connect", "createConnection", "createServer"], "network access");
  }
  const dgram = builtin("node:dgram");
  if (dgram !== undefined) {
    patch(
      (dgram["Socket"] as { prototype?: unknown } | undefined)?.prototype,
      ["bind", "connect", "send"],
      "network access",
    );
    patch(dgram, ["createSocket"], "network access");
  }
  const dns = builtin("node:dns");
  if (dns !== undefined) {
    // By pattern, not by list: every lookup*/resolve*/reverse function (resolveCaa, resolveNaptr, resolveSoa and
    // whatever a later Node adds), on the callback API, the promise API, and BOTH Resolver classes — a DNS query
    // is a way to send data out, so one forgotten method is an open door.
    const isQuery = (name: string): boolean => /^(lookup|resolve|reverse|setServers)/.test(name);
    const patchQueries = (target: unknown): void => {
      if (target === null || target === undefined) return;
      const names = new Set<string>();
      for (let o: unknown = target; o !== null && o !== Object.prototype;) {
        for (const name of Object.getOwnPropertyNames(o)) {
          if (isQuery(name) && typeof (target as Patchable)[name] === "function") names.add(name);
        }
        o = Object.getPrototypeOf(o) as unknown;
      }
      patch(target, [...names], "name resolution");
    };
    const promises = dns["promises"] as Patchable | undefined;
    patchQueries(dns);
    patchQueries(promises);
    patchQueries((dns["Resolver"] as { prototype?: unknown } | undefined)?.prototype);
    patchQueries((promises?.["Resolver"] as { prototype?: unknown } | undefined)?.prototype);
  }
  for (const id of ["node:http", "node:https", "node:http2", "node:tls"]) {
    patch(
      builtin(id),
      ["request", "get", "connect", "createServer", "createSecureServer"],
      "network access",
    );
  }
  syncBuiltinESMExports();

  const g = globalThis as Patchable;
  for (const name of ["fetch", "WebSocket", "EventSource", "XMLHttpRequest"]) {
    try {
      Object.defineProperty(g, name, {
        value: deny("network access"),
        writable: false,
        configurable: false,
      });
    } catch {
      // see above
    }
  }

  // Parser libraries log warnings that can quote file content; stdout carries the protocol and nothing else.
  const silent = (): void => undefined;
  const c = console as unknown as Patchable;
  for (const name of ["log", "info", "warn", "error", "debug", "trace", "dir", "table"])
    c[name] = silent;
}
