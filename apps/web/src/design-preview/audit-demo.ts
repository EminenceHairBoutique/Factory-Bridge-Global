/**
 * Display-only rules for the audit explorer (IA §2.4 `/ops/audit`; PRD AC-A1.1; BACKLOG B-26;
 * permission matrix row `audit_events`; migration 0003). Read-only: there is no edit or delete.
 * Scope by role: an assigned operator reads events of assigned projects only; compliance and
 * platform admins read everything; security events are compliance and admin only; every
 * platform-admin read is itself audited, and so is every export. Restricted values (supplier
 * contact handles) are redacted in diffs for roles that cannot read them. The hash chain per
 * entity is checked: each event's before-hash must equal the previous event's after-hash.
 */
import {
  AUDIT_EVENTS,
  AUDIT_NOW,
  DOCUMENT_ACCESS,
  OPERATOR_PROJECTS,
  SECURITY_EVENTS,
  type ActingAs,
  type AuditEvent,
  type DocumentAccess,
  type SecurityEvent,
} from "./demo-data/audit";

export type ViewerRole = "operator" | "compliance" | "admin";

export const VIEWER_LABEL: Record<ViewerRole, string> = {
  operator: "Operator (demo)",
  compliance: "Compliance (demo)",
  admin: "Platform admin (demo)",
};

export const ACTING_AS_LABEL: Record<ActingAs, string> = {
  member: "Member",
  internal: "Internal",
  platform_admin: "Platform admin",
  system: "System",
};

export function scopedEvents(
  role: ViewerRole,
  events: readonly AuditEvent[] = AUDIT_EVENTS,
): AuditEvent[] {
  if (role !== "operator") return [...events];
  const mine = new Set<string>(OPERATOR_PROJECTS);
  return events.filter((e) => e.projectId !== null && mine.has(e.projectId));
}

export function scopedSecurity(
  role: ViewerRole,
  events: readonly SecurityEvent[] = SECURITY_EVENTS,
): SecurityEvent[] {
  return role === "operator" ? [] : [...events];
}

export function scopedAccess(
  role: ViewerRole,
  rows: readonly DocumentAccess[] = DOCUMENT_ACCESS,
): DocumentAccess[] {
  if (role !== "operator") return [...rows];
  const mine = new Set<string>(OPERATOR_PROJECTS);
  return rows.filter((r) => r.projectId !== null && mine.has(r.projectId));
}

export interface AuditFilter {
  text: string;
  entityTable: string;
  org: string;
  actingAs: ActingAs | "all";
  from: string;
  to: string;
  requestId: string | null;
  entity: { table: string; id: string } | null;
}

export const EMPTY_FILTER: AuditFilter = {
  text: "",
  entityTable: "all",
  org: "all",
  actingAs: "all",
  from: "",
  to: "",
  requestId: null,
  entity: null,
};

export function filterEvents(events: readonly AuditEvent[], f: AuditFilter): AuditEvent[] {
  const q = f.text.trim().toLowerCase();
  return events
    .filter((e) => {
      if (f.entityTable !== "all" && e.entityTable !== f.entityTable) return false;
      if (f.org !== "all" && e.entityOrg !== f.org && e.actorOrg !== f.org) return false;
      if (f.actingAs !== "all" && e.actingAs !== f.actingAs) return false;
      if (f.from && e.at.slice(0, 10) < f.from) return false;
      if (f.to && e.at.slice(0, 10) > f.to) return false;
      if (f.requestId && e.requestId !== f.requestId) return false;
      if (f.entity && (e.entityTable !== f.entity.table || e.entityId !== f.entity.id))
        return false;
      if (
        q &&
        !`${e.action} ${e.entityLabel} ${e.entityTable} ${e.entityId} ${e.actor} ${e.requestId ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

export function validateDateRange(from: string, to: string): string | null {
  return from && to && from > to ? "The start date is after the end date." : null;
}

/* ---------- Integrity ---------- */

export type ChainState = "consistent" | "unverifiable" | "mismatch";

export interface ChainLink {
  event: AuditEvent;
  state: "first" | "linked" | "unverifiable" | "mismatch";
}

/** Each event's before-hash must equal the previous event's after-hash for the same entity. */
export function entityChain(
  events: readonly AuditEvent[],
  table: string,
  id: string,
): { state: ChainState; links: ChainLink[] } {
  const own = events
    .filter((e) => e.entityTable === table && e.entityId === id && e.action !== "read")
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const links: ChainLink[] = own.map((event, i) => {
    if (i === 0) return { event, state: "first" };
    const prev = own[i - 1]!;
    if (prev.afterHash === null || event.beforeHash === null)
      return { event, state: "unverifiable" };
    return { event, state: prev.afterHash === event.beforeHash ? "linked" : "mismatch" };
  });
  const state: ChainState = links.some((l) => l.state === "mismatch")
    ? "mismatch"
    : links.some((l) => l.state === "unverifiable")
      ? "unverifiable"
      : "consistent";
  return { state, links };
}

export const CHAIN_LABEL: Record<ChainState, string> = {
  consistent: "Hash chain consistent",
  unverifiable: "Chain has an unverifiable link",
  mismatch: "Hash mismatch: investigate",
};

/* ---------- Redaction ---------- */

const RESTRICTED_FIELDS: Record<string, readonly string[]> = {
  supplier_contacts: ["handle", "phone", "email"],
};

export const REDACTED = "[restricted]";

/** Operators cannot read supplier contact values, so their diffs never show them. */
export function redactDiff(e: AuditEvent, role: ViewerRole): AuditEvent["diff"] {
  if (!e.diff) return null;
  const restricted = role === "operator" ? (RESTRICTED_FIELDS[e.entityTable] ?? []) : [];
  return Object.fromEntries(
    Object.entries(e.diff).map(([k, [b, a]]) => [
      k,
      restricted.includes(k)
        ? [b === null ? null : REDACTED, a === null ? null : REDACTED]
        : [b, a],
    ]),
  );
}

export function showValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.map((x) => showValue(x)).join(", ");
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/* ---------- Reads and exports are audited ---------- */

function auditOfAudit(
  role: ViewerRole,
  action: string,
  label: string,
  at: string,
  n: number,
): AuditEvent {
  return {
    id: `x-${action}-${at}-${n}`,
    at,
    actor: VIEWER_LABEL[role],
    actorOrg: "Factory Bridge Global",
    entityOrg: "Factory Bridge Global",
    actingAs: role === "admin" ? "platform_admin" : "internal",
    entityTable: "audit_events",
    entityId: "query",
    entityLabel: label,
    action,
    beforeHash: null,
    afterHash: null,
    diff: null,
    requestId: `r-ui-${n}`,
    ipHash: "ip:local",
    projectId: null,
  };
}

/** Only platform-admin reads are audited (matrix: "every read is audited"). */
export function readEvent(
  role: ViewerRole,
  target: AuditEvent,
  at: string,
  n: number,
): AuditEvent | null {
  if (role !== "admin") return null;
  return auditOfAudit(
    role,
    "read",
    `Read ${target.entityTable} ${target.entityId} (event ${target.id})`,
    at,
    n,
  );
}

export function exportEvent(role: ViewerRole, rows: number, at: string, n: number): AuditEvent {
  return auditOfAudit(
    role,
    "export",
    `Exported ${rows} audit row${rows === 1 ? "" : "s"} (${VIEWER_LABEL[role]} scope)`,
    at,
    n,
  );
}

export const CSV_COLUMNS = [
  "at",
  "actor",
  "actor_org",
  "acting_as",
  "entity_table",
  "entity_id",
  "entity_label",
  "action",
  "entity_org",
  "request_id",
  "before_hash",
  "after_hash",
  "diff",
  "ip_hash",
] as const;

export function toAuditCsv(events: readonly AuditEvent[], role: ViewerRole): string {
  const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = events.map((e) => [
    e.at,
    e.actor,
    e.actorOrg,
    e.actingAs,
    e.entityTable,
    e.entityId,
    e.entityLabel,
    e.action,
    e.entityOrg,
    e.requestId ?? "",
    e.beforeHash ?? "",
    e.afterHash ?? "",
    e.diff ? JSON.stringify(redactDiff(e, role)) : "",
    e.ipHash ?? "",
  ]);
  return [[...CSV_COLUMNS], ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

export function exportFileName(role: ViewerRole, today: string): string {
  return `audit-export-${role}-${today}.csv`;
}

/* ---------- Privileged access report (B-26) ---------- */

export interface PrivilegedRow {
  at: string;
  who: string;
  what: string;
  source: "audit" | "security";
}

/** Last 7 days of platform-admin reads and privileged-access security events. */
export function privilegedAccess(
  now: string = AUDIT_NOW,
  events: readonly AuditEvent[] = AUDIT_EVENTS,
  security: readonly SecurityEvent[] = SECURITY_EVENTS,
): PrivilegedRow[] {
  const since = new Date(Date.parse(now) - 7 * 86_400_000).toISOString();
  const a = events
    .filter((e) => e.actingAs === "platform_admin" && e.at >= since)
    .map((e) => ({
      at: e.at,
      who: e.actor,
      what: `${e.action} ${e.entityTable} ${e.entityId}`,
      source: "audit" as const,
    }));
  const s = security
    .filter((x) => x.kind === "privileged_access" && x.at >= since)
    .map((x) => ({
      at: x.at,
      who: x.actor ?? "unknown",
      what: `privileged access ${String(x.details.table ?? "")} ${String(x.details.entity ?? "")}`.trim(),
      source: "security" as const,
    }));
  return [...a, ...s].sort((p, q) => q.at.localeCompare(p.at));
}

export function requestGroup(
  events: readonly AuditEvent[],
  requestId: string | null,
): AuditEvent[] {
  return requestId ? events.filter((e) => e.requestId === requestId) : [];
}

export function shortHash(h: string | null): string {
  return h ? `${h.slice(0, 8)}…` : "—";
}
