"use client";

/**
 * Internal operations: Audit explorer (IA §2.4 `/ops/audit` "Audit Explorer (read-only)"; PRD
 * AC-A1.1; BACKLOG B-26; migration 0003; permission matrix row `audit_events`). Read-only: filters
 * by organization, entity and date (plus actor role, request and text); event detail with the diff
 * (restricted values redacted by role), hashes, the entity's hash chain and the other events of
 * the same request; security events and document access for the roles allowed to see them; the
 * weekly privileged-access report; and CSV export. Platform-admin reads and every export are
 * themselves recorded. Local state only; nothing is written anywhere.
 */
import { useMemo, useState } from "react";
import { AUDIT_EVENTS, AUDIT_NOW, type ActingAs, type AuditEvent } from "../demo-data/audit";
import {
  ACTING_AS_LABEL,
  CHAIN_LABEL,
  EMPTY_FILTER,
  VIEWER_LABEL,
  entityChain,
  exportEvent,
  exportFileName,
  filterEvents,
  privilegedAccess,
  readEvent,
  redactDiff,
  requestGroup,
  scopedAccess,
  scopedEvents,
  scopedSecurity,
  shortHash,
  showValue,
  toAuditCsv,
  validateDateRange,
  type AuditFilter,
  type ViewerRole,
} from "../audit-demo";
import { AppShell } from "../ui/AppShell";
import {
  Badge,
  Button,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  TextInput,
  cx,
  type Tone,
} from "../ui/primitives";

type Tab = "events" | "security" | "access";

const ACTING_TONE: Record<ActingAs, Tone> = {
  member: "ink",
  internal: "teal",
  platform_admin: "warn",
  system: "neutral",
};
const CHAIN_TONE = { consistent: "ok", unverifiable: "warn", mismatch: "danger" } as const;
const TODAY = AUDIT_NOW.slice(0, 10);

function when(at: string): string {
  return at.slice(0, 16).replace("T", " ");
}

export function OpsAuditExplorer({ initialEventId }: { initialEventId?: string | undefined }) {
  const [role, setRole] = useState<ViewerRole>("compliance");
  const [tab, setTab] = useState<Tab>("events");
  const [filter, setFilter] = useState<AuditFilter>(EMPTY_FILTER);
  const [session, setSession] = useState<AuditEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEventId && AUDIT_EVENTS.some((e) => e.id === initialEventId) ? initialEventId : null,
  );
  const [prepared, setPrepared] = useState<{ fileName: string; rows: number; csv: string } | null>(
    null,
  );

  const all = useMemo(() => [...AUDIT_EVENTS, ...session], [session]);
  const scoped = useMemo(() => scopedEvents(role, all), [role, all]);
  const dateError = validateDateRange(filter.from, filter.to);
  const rows = useMemo(
    () => (dateError ? [] : filterEvents(scoped, filter)),
    [scoped, filter, dateError],
  );
  const security = scopedSecurity(role);
  const access = scopedAccess(role);
  const selected = scoped.find((e) => e.id === selectedId) ?? null;
  const tables = [...new Set(scoped.map((e) => e.entityTable))].sort();
  const orgs = [...new Set(scoped.flatMap((e) => [e.entityOrg, e.actorOrg]))].sort();
  const chainIssues = useMemo(() => {
    const keys = [...new Set(scoped.map((e) => `${e.entityTable}|${e.entityId}`))];
    return keys.filter((k) => {
      const [t, id] = k.split("|") as [string, string];
      return entityChain(scoped, t, id).state !== "consistent";
    }).length;
  }, [scoped]);

  const stamp = () => `${TODAY}T${new Date().toISOString().slice(11, 19)}Z`;
  const open = (e: AuditEvent) => {
    setSelectedId(e.id);
    const r = readEvent(role, e, stamp(), session.length + 1);
    if (r) setSession((s) => [...s, r]);
  };
  const switchRole = (r: ViewerRole) => {
    setRole(r);
    setSelectedId(null);
    setPrepared(null);
    setFilter(EMPTY_FILTER);
  };
  const prepareExport = () => {
    const csv = toAuditCsv(rows, role);
    setPrepared({ fileName: exportFileName(role, TODAY), rows: rows.length, csv });
    setSession((s) => [...s, exportEvent(role, rows.length, stamp(), s.length + 1)]);
  };
  const download = () => {
    if (!prepared) return;
    const url = URL.createObjectURL(new Blob([prepared.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = prepared.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell workspace="ops" title="Audit">
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="lock" title="Read-only record">
          Audit rows are append-only: nothing here can be edited or deleted. Retention of 7 years is
          proposed but not yet decided (OQ-07). IP addresses are stored only as hashes.
        </Notice>

        <PageHeader
          title="Audit explorer"
          lead="Who changed what, when, acting as whom, with the record's hashes and the request it belonged to. Filter by organization, entity and date."
          meta={
            <>
              <Badge tone="neutral" icon="list" className="fbg-num">
                {scoped.length} events in your scope
              </Badge>
              <Badge
                tone={chainIssues > 0 ? "warn" : "ok"}
                icon={chainIssues > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {chainIssues} entit{chainIssues === 1 ? "y" : "ies"} with chain notes
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                As of {when(AUDIT_NOW)} UTC
              </Badge>
            </>
          }
          actions={
            <div className="flex max-w-full min-w-0 flex-col items-start gap-1">
              <span className="text-xs text-(--fbg-text-secondary)">View as</span>
              <SegmentedControl
                label="View as role"
                size="sm"
                value={role}
                onChange={switchRole}
                options={[
                  { value: "operator", label: "Operator" },
                  { value: "compliance", label: "Compliance" },
                  { value: "admin", label: "Admin" },
                ]}
              />
            </div>
          }
        />

        {role === "operator" ? (
          <Notice tone="neutral" icon="info" title="Assigned projects only">
            Operators read audit events for their assigned projects (labels, cartons, mailers).
            Supplier records, other projects and security events are outside this scope.
          </Notice>
        ) : role === "admin" ? (
          <Notice tone="warn" icon="eye" title="Your reads are audited">
            Each event you open and each export is recorded as an audit event under your name,
            acting as platform admin, and appears in the privileged-access report.
          </Notice>
        ) : null}

        <SegmentedControl
          label="Record"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "events", label: `Audit events (${scoped.length})` },
            { value: "security", label: `Security (${security.length})` },
            { value: "access", label: `Document access (${access.length})` },
          ]}
        />

        {tab === "events" ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <TextInput
                aria-label="Search events"
                placeholder="Action, entity, actor or request"
                value={filter.text}
                onChange={(e) => setFilter({ ...filter, text: e.target.value })}
              />
              <Select
                aria-label="Entity"
                value={filter.entityTable}
                onChange={(e) => setFilter({ ...filter, entityTable: e.target.value })}
              >
                <option value="all">All entities</option>
                {tables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Organization"
                value={filter.org}
                onChange={(e) => setFilter({ ...filter, org: e.target.value })}
              >
                <option value="all">All organizations</option>
                {orgs.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Acting as"
                value={filter.actingAs}
                onChange={(e) =>
                  setFilter({ ...filter, actingAs: e.target.value as AuditFilter["actingAs"] })
                }
              >
                <option value="all">Any role</option>
                {(Object.keys(ACTING_AS_LABEL) as ActingAs[]).map((a) => (
                  <option key={a} value={a}>
                    {ACTING_AS_LABEL[a]}
                  </option>
                ))}
              </Select>
              <TextInput
                aria-label="From date"
                type="date"
                value={filter.from}
                onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              />
              <TextInput
                aria-label="To date"
                type="date"
                value={filter.to}
                onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              />
            </div>
            {dateError ? <p className="text-xs text-(--fbg-status-danger)">{dateError}</p> : null}
            {filter.requestId || filter.entity ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {filter.requestId ? (
                  <Badge tone="teal" icon={null}>
                    Request {filter.requestId}
                  </Badge>
                ) : null}
                {filter.entity ? (
                  <Badge tone="teal" icon={null}>
                    {filter.entity.table} {filter.entity.id}
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFilter({ ...filter, requestId: null, entity: null })}
                >
                  Clear
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="flex min-w-0 flex-col gap-4">
                <Panel padded={false}>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[44rem] text-sm">
                      <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
                        <tr>
                          {[
                            "Time (UTC)",
                            "Actor",
                            "Acting as",
                            "Action",
                            "Entity",
                            "Organization",
                          ].map((h) => (
                            <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--fbg-border-subtle)">
                        {rows.map((e) => (
                          <tr
                            key={e.id}
                            className={cx(
                              "cursor-pointer hover:bg-(--fbg-hover) [&>td]:px-3 [&>td]:py-2 [&>td]:align-top",
                              selectedId === e.id && "bg-(--fbg-selected)",
                            )}
                            onClick={() => open(e)}
                          >
                            <td className="fbg-num whitespace-nowrap text-(--fbg-text-secondary)">
                              {when(e.at)}
                            </td>
                            <td className="text-(--fbg-text-primary)">{e.actor}</td>
                            <td>
                              <Badge tone={ACTING_TONE[e.actingAs]} icon={null}>
                                {ACTING_AS_LABEL[e.actingAs]}
                              </Badge>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="text-left font-medium text-(--fbg-text-primary) hover:underline"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  open(e);
                                }}
                              >
                                {e.action}
                              </button>
                            </td>
                            <td className="text-(--fbg-text-primary)">
                              <span className="block">{e.entityLabel}</span>
                              <span className="fbg-num block text-xs text-(--fbg-text-secondary)">
                                {e.entityTable}
                              </span>
                            </td>
                            <td className="text-xs text-(--fbg-text-secondary)">{e.entityOrg}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="divide-y divide-(--fbg-border-subtle) md:hidden">
                    {rows.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => open(e)}
                          className={cx(
                            "flex w-full flex-col gap-1 px-4 py-3 text-left",
                            selectedId === e.id && "bg-(--fbg-selected)",
                          )}
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={ACTING_TONE[e.actingAs]} icon={null}>
                              {ACTING_AS_LABEL[e.actingAs]}
                            </Badge>
                            <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                              {when(e.at)}
                            </span>
                          </span>
                          <span className="text-sm font-medium text-(--fbg-text-primary)">
                            {e.action} · {e.entityLabel}
                          </span>
                          <span className="truncate text-xs text-(--fbg-text-secondary)">
                            {e.actor} · {e.entityTable}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {rows.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-(--fbg-text-secondary)">
                      No events match these filters.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--fbg-border-subtle) px-4 py-2.5 text-xs text-(--fbg-text-secondary)">
                    <span className="fbg-num">
                      {rows.length} of {scoped.length} events in your scope · newest first
                    </span>
                    <Button
                      size="sm"
                      icon="download"
                      disabled={rows.length === 0}
                      onClick={prepareExport}
                    >
                      Prepare CSV export
                    </Button>
                  </div>
                </Panel>

                {prepared ? (
                  <Panel
                    title="Export ready"
                    description="The export itself has been recorded as an audit event."
                  >
                    <p className="fbg-num text-sm text-(--fbg-text-primary)">
                      {prepared.fileName} · {prepared.rows} row{prepared.rows === 1 ? "" : "s"} ·
                      diffs redacted for your role · IPs as hashes only
                    </p>
                    <pre className="mt-2 max-h-40 overflow-auto rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-2 text-[11px] text-(--fbg-text-secondary)">
                      {prepared.csv.split("\n").slice(0, 4).join("\n")}
                    </pre>
                    <div className="mt-3">
                      <Button variant="primary" icon="download" onClick={download}>
                        Download CSV
                      </Button>
                    </div>
                  </Panel>
                ) : null}

                {role !== "operator" ? (
                  <Panel
                    title="Privileged access, last 7 days"
                    description="Platform-admin reads and privileged-access security events (the weekly report)."
                    padded={false}
                  >
                    <ul className="divide-y divide-(--fbg-border-subtle)">
                      {privilegedAccess(AUDIT_NOW, all).map((p, i) => (
                        <li
                          key={`${p.at}-${i}`}
                          className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm"
                        >
                          <Badge tone={p.source === "audit" ? "warn" : "danger"} icon={null}>
                            {p.source === "audit" ? "Audit" : "Security"}
                          </Badge>
                          <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                            {when(p.at)}
                          </span>
                          <span className="text-(--fbg-text-primary)">
                            {p.who}: {p.what}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                ) : null}
              </div>

              <div className="min-w-0">
                {selected ? (
                  <EventDetail
                    e={selected}
                    role={role}
                    scoped={scoped}
                    onRequest={(id) => setFilter({ ...EMPTY_FILTER, requestId: id })}
                    onEntity={(table, id) => setFilter({ ...EMPTY_FILTER, entity: { table, id } })}
                  />
                ) : (
                  <EmptyState
                    title="Select an event"
                    body="Open any row to see its diff, hashes, hash chain and request."
                    icon="list"
                  />
                )}
              </div>
            </div>
          </>
        ) : null}

        {tab === "security" ? (
          security.length === 0 ? (
            <EmptyState
              title="Not in your scope"
              body="Security events are visible to compliance reviewers and platform admins."
              icon="lock"
            />
          ) : (
            <Panel padded={false}>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {security.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          s.kind === "privileged_access"
                            ? "warn"
                            : s.kind === "rls_denied" || s.kind === "injection_flag"
                              ? "danger"
                              : "neutral"
                        }
                        icon={null}
                      >
                        {s.kind}
                      </Badge>
                      <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                        {when(s.at)}
                      </span>
                      <span className="text-(--fbg-text-primary)">
                        {s.actor ?? "Unauthenticated"}
                      </span>
                      {s.org ? (
                        <span className="text-xs text-(--fbg-text-secondary)">{s.org}</span>
                      ) : null}
                    </span>
                    <span className="text-xs break-all text-(--fbg-text-secondary)">
                      {Object.entries(s.details)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )
        ) : null}

        {tab === "access" ? (
          <Panel
            padded={false}
            title="Document access log"
            description="Views, downloads and signed links. IPs are hashes."
          >
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {access.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
                  <Badge
                    tone={
                      a.action === "download"
                        ? "warn"
                        : a.action === "signed_url"
                          ? "teal"
                          : "neutral"
                    }
                    icon={null}
                  >
                    {a.action}
                  </Badge>
                  <span className="fbg-num text-xs text-(--fbg-text-secondary)">{when(a.at)}</span>
                  <span className="text-(--fbg-text-primary)">{a.documentLabel}</span>
                  <span className="text-xs text-(--fbg-text-secondary)">
                    {a.user} · {a.org} · {a.ipHash ?? "—"}
                  </span>
                </li>
              ))}
              {access.length === 0 ? (
                <li className="px-5 py-4 text-sm text-(--fbg-text-secondary)">
                  No access rows in your scope.
                </li>
              ) : null}
            </ul>
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}

function EventDetail({
  e,
  role,
  scoped,
  onRequest,
  onEntity,
}: {
  e: AuditEvent;
  role: ViewerRole;
  scoped: AuditEvent[];
  onRequest: (id: string) => void;
  onEntity: (table: string, id: string) => void;
}) {
  const diff = redactDiff(e, role);
  const chain = entityChain(scoped, e.entityTable, e.entityId);
  const group = requestGroup(scoped, e.requestId);
  return (
    <Panel title={`${e.action} · ${e.entityLabel}`} description={`Event ${e.id}`}>
      <KeyValue
        columns={1}
        items={[
          { label: "When (UTC)", value: when(e.at) },
          { label: "Actor", value: `${e.actor} · ${e.actorOrg}` },
          { label: "Acting as", value: ACTING_AS_LABEL[e.actingAs] },
          { label: "Entity", value: `${e.entityTable} · ${e.entityId}` },
          { label: "Entity organization", value: e.entityOrg },
          { label: "Request", value: e.requestId ?? "—" },
          { label: "IP", value: e.ipHash ? `${e.ipHash} (hash)` : "—" },
          {
            label: "Before / after hash",
            value: `${shortHash(e.beforeHash)} → ${shortHash(e.afterHash)}`,
          },
        ]}
      />

      <p className="mt-4 text-xs font-semibold text-(--fbg-text-primary)">Change</p>
      {diff ? (
        <table className="mt-1 w-full text-xs">
          <thead className="text-(--fbg-text-secondary)">
            <tr>
              <th className="py-1 text-left font-medium">Field</th>
              <th className="py-1 text-left font-medium">Before</th>
              <th className="py-1 text-left font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(diff).map(([k, [b, a]]) => (
              <tr key={k} className="border-t border-(--fbg-border-subtle) align-top">
                <td className="py-1 pr-2 font-medium text-(--fbg-text-primary)">{k}</td>
                <td className="py-1 pr-2 break-all text-(--fbg-text-secondary)">{showValue(b)}</td>
                <td className="py-1 break-all text-(--fbg-text-primary)">{showValue(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">No change recorded (a read).</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge
          tone={CHAIN_TONE[chain.state]}
          icon={chain.state === "consistent" ? "check" : "alert"}
        >
          {CHAIN_LABEL[chain.state]}
        </Badge>
        <span className="fbg-num text-xs text-(--fbg-text-secondary)">
          {chain.links.length} event{chain.links.length === 1 ? "" : "s"} on this entity
        </span>
      </div>
      <ol className="mt-2 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
        {chain.links.map((l) => (
          <li key={l.event.id} className="fbg-num">
            {when(l.event.at)} · {l.event.action} · {shortHash(l.event.beforeHash)} →{" "}
            {shortHash(l.event.afterHash)}{" "}
            {l.state === "unverifiable"
              ? "(previous hash not recorded)"
              : l.state === "mismatch"
                ? "(does not match the previous hash)"
                : ""}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => onEntity(e.entityTable, e.entityId)}>
          Entity history
        </Button>
        {e.requestId && group.length > 1 ? (
          <Button size="sm" variant="secondary" onClick={() => onRequest(e.requestId!)}>
            {group.length} events in this request
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-(--fbg-text-secondary)">
        Viewing as {VIEWER_LABEL[role]}. This record cannot be edited or deleted.
      </p>
    </Panel>
  );
}
