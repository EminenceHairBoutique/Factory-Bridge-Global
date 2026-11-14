/**
 * File names are attacker-controlled text. The original name is kept only as a label (`documents.original_filename`);
 * it is never used as a path. The object key of a promoted file is built here from the content hash and an ASCII
 * slug, so it cannot traverse, collide with a device name, hide its real extension, or carry characters the storage
 * service rejects (Supabase Storage keys are ASCII-only).
 */

export type DocumentKind = "pdf" | "xlsx" | "csv" | "jpeg" | "png" | "webp";

/** The one extension a promoted object of each kind carries, whatever the upload was called. */
export const CANONICAL_EXTENSION: Readonly<Record<DocumentKind, string>> = {
  pdf: "pdf",
  xlsx: "xlsx",
  csv: "csv",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/** Lower-cased final extension without the dot; "" when there is none. Trailing dots and spaces are ignored. */
export function extensionOf(filename: string): string {
  const trimmed = filename.replace(/[\s.]+$/u, "");
  const base = trimmed.slice(Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\")) + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const MAX_SLUG = 60;

/** An ASCII slug of the name without its extension: [A-Za-z0-9_-], never empty, never a reserved device name. */
export function slugOf(filename: string): string {
  // Normalize first, then cut: normalization can change the length and can itself produce a slash (U+FF0F).
  const normalized = filename.normalize("NFKC");
  const base = normalized.slice(
    Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\")) + 1,
  );
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  let slug = stem
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, MAX_SLUG);
  if (!/[A-Za-z0-9]/.test(slug)) slug = "document";
  if (WINDOWS_RESERVED.test(slug)) slug = `file_${slug}`;
  return slug;
}

/** `<first 12 hex of sha256>-<slug>.<canonical extension>` — the file part of a promoted object's key. */
export function promotedFileName(
  sha256: string,
  originalFilename: string,
  kind: DocumentKind,
): string {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("sha256 must be 64 lowercase hex characters");
  return `${sha256.slice(0, 12)}-${slugOf(originalFilename)}.${CANONICAL_EXTENSION[kind]}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY_FILE = /^[A-Za-z0-9!_.*'()&$@=;:+,? -]{1,200}$/;

/**
 * True when `storagePath` is exactly `<orgId>/<documentId>/<file>` with one plain file segment. The database
 * trigger enforces the same shape; the worker checks it again because it reads objects as service_role, where no
 * policy would stop a path that pointed at another organization's folder.
 */
export function isBoundStoragePath(
  storagePath: string,
  orgId: string,
  documentId: string,
): boolean {
  if (!UUID.test(orgId) || !UUID.test(documentId)) return false;
  const prefix = `${orgId}/${documentId}/`;
  if (!storagePath.startsWith(prefix)) return false;
  const file = storagePath.slice(prefix.length);
  return KEY_FILE.test(file) && file !== "." && file !== ".." && !file.includes("/");
}
