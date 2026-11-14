/**
 * A deliberately small, read-only ZIP reader for OOXML packages (sandbox side). It exists so that the limits are
 * ours: the central directory is parsed with strict bounds, nothing is inflated until a part is asked for, and every
 * inflation has a hard output cap, so a decompression bomb costs at most the configured budget. It supports exactly
 * what a spreadsheet package needs (stored and deflated entries, no ZIP64, no encryption, no multi-disk) and refuses
 * the rest instead of guessing.
 */
import { crc32, inflateRawSync } from "node:zlib";
import { SandboxReject } from "./protocol.mts";

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;
const EOCD_MIN = 22;
const MAX_COMMENT = 0xffff;

export interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly crc: number;
  readonly localOffset: number;
}

export interface ZipLimits {
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxInflatedBytes: number;
}

/** Position of a well-formed end-of-central-directory record that terminates the buffer exactly, or -1. */
export function findEndOfCentralDirectory(buf: Buffer): number {
  const lowest = Math.max(0, buf.length - EOCD_MIN - MAX_COMMENT);
  for (let i = buf.length - EOCD_MIN; i >= lowest; i--) {
    if (buf.readUInt32LE(i) !== EOCD_SIG) continue;
    if (i + EOCD_MIN + buf.readUInt16LE(i + 20) === buf.length) return i;
  }
  return -1;
}

export class ZipArchive {
  readonly entries: ReadonlyMap<string, ZipEntry>;
  private readonly buf: Buffer;
  private readonly limits: ZipLimits;
  private inflated = 0;

  constructor(buf: Buffer, limits: ZipLimits) {
    this.buf = buf;
    this.limits = limits;
    this.entries = readCentralDirectory(buf, limits);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  names(): string[] {
    return [...this.entries.keys()];
  }

  /** Inflates one part, verifying its declared size and CRC. Throws SandboxReject on any inconsistency. */
  read(name: string): Buffer {
    const entry = this.entries.get(name);
    if (entry === undefined) throw new SandboxReject("corrupt_file", "missing package part");
    if (entry.uncompressedSize > this.limits.maxEntryBytes) {
      throw new SandboxReject("zip_bomb", `part larger than ${this.limits.maxEntryBytes} bytes`);
    }
    if (this.inflated + entry.uncompressedSize > this.limits.maxInflatedBytes) {
      throw new SandboxReject(
        "zip_bomb",
        `package inflates past ${this.limits.maxInflatedBytes} bytes`,
      );
    }
    const buf = this.buf;
    const at = entry.localOffset;
    if (at + 30 > buf.length || buf.readUInt32LE(at) !== LOC_SIG) {
      throw new SandboxReject("corrupt_file", "bad local file header");
    }
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const end = start + entry.compressedSize;
    if (end > buf.length) throw new SandboxReject("corrupt_file", "part runs past end of file");
    const raw = buf.subarray(start, end);

    let out: Buffer;
    if (entry.method === 0) {
      if (entry.compressedSize !== entry.uncompressedSize) {
        throw new SandboxReject("corrupt_file", "stored part with mismatched sizes");
      }
      out = raw;
    } else {
      try {
        // One byte of slack: a part that inflates past its declared size fails the length check below instead of
        // being silently truncated to it.
        out = inflateRawSync(raw, { maxOutputLength: entry.uncompressedSize + 1 });
      } catch (err) {
        if ((err as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") {
          throw new SandboxReject("zip_bomb", "part inflates past its declared size");
        }
        throw new SandboxReject("corrupt_file", "part does not inflate");
      }
    }
    if (out.length !== entry.uncompressedSize) {
      throw new SandboxReject(
        out.length > entry.uncompressedSize ? "zip_bomb" : "corrupt_file",
        "part size differs from its declared size",
      );
    }
    if (crc32(out) !== entry.crc) throw new SandboxReject("corrupt_file", "part checksum mismatch");
    this.inflated += out.length;
    return out;
  }
}

function readCentralDirectory(buf: Buffer, limits: ZipLimits): Map<string, ZipEntry> {
  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new SandboxReject("corrupt_file", "no end of central directory");
  const disk = buf.readUInt16LE(eocd + 4);
  const cdDisk = buf.readUInt16LE(eocd + 6);
  const onDisk = buf.readUInt16LE(eocd + 8);
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (disk !== 0 || cdDisk !== 0 || onDisk !== total) {
    throw new SandboxReject("unsupported_structure", "multi-disk archive");
  }
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new SandboxReject("unsupported_structure", "ZIP64 archive");
  }
  if (total === 0) throw new SandboxReject("corrupt_file", "empty archive");
  if (total > limits.maxEntries) {
    throw new SandboxReject("zip_bomb", `more than ${limits.maxEntries} parts`);
  }
  if (cdOffset + cdSize > eocd) {
    throw new SandboxReject("corrupt_file", "central directory out of bounds");
  }

  const entries = new Map<string, ZipEntry>();
  const seen = new Set<string>();
  // Every entry counts toward the budget, read or not: the whole file is what gets scanned and promoted, so a
  // package may not carry more (declared) content than this reader — and a scanner with ordinary limits — will cover.
  let declaredTotal = 0;
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > eocd || buf.readUInt32LE(p) !== CEN_SIG) {
      throw new SandboxReject("corrupt_file", "bad central directory entry");
    }
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const next = p + 46 + nameLen + extraLen + commentLen;
    if (next > eocd) throw new SandboxReject("corrupt_file", "central directory entry overruns");
    if ((flags & 0x1) !== 0 || (flags & 0x40) !== 0) throw new SandboxReject("encrypted_file");
    if (method !== 0 && method !== 8) {
      throw new SandboxReject("unsupported_structure", `compression method ${method}`);
    }
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      throw new SandboxReject("unsupported_structure", "ZIP64 entry");
    }
    if (uncompressedSize > limits.maxEntryBytes) {
      throw new SandboxReject("zip_bomb", `part larger than ${limits.maxEntryBytes} bytes`);
    }
    declaredTotal += uncompressedSize;
    if (declaredTotal > limits.maxInflatedBytes) {
      throw new SandboxReject(
        "zip_bomb",
        `package declares more than ${limits.maxInflatedBytes} bytes`,
      );
    }
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    if (!isSafeEntryName(name)) throw new SandboxReject("corrupt_file", "unsafe part name");
    const folded = name.toLowerCase();
    if (seen.has(folded)) throw new SandboxReject("corrupt_file", "duplicate part name");
    seen.add(folded);
    if (!name.endsWith("/")) {
      entries.set(name, { name, method, compressedSize, uncompressedSize, crc, localOffset });
    }
    p = next;
  }
  return entries;
}

function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name.length > 255) return false;
  if (name.startsWith("/") || name.includes("\\") || name.includes("\u0000")) return false;
  if (name.includes("�")) return false; // not valid UTF-8
  return !name.split("/").some((segment) => segment === ".." || segment === ".");
}
