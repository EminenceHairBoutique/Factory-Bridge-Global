"use client";

/**
 * Operations: Supplier CRM list (IA §2.4 `/ops/suppliers`; BACKLOG B-09). Dense sortable table with filters;
 * cards on phones. Local state only; synthetic data.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  OPS_SUPPLIERS,
  OPS_TODAY,
  STAGE_LABEL,
  STAGE_ORDER,
  type OpsSupplier,
} from "../demo-data/ops-suppliers";
import { checksDue } from "../ops-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextInput,
  buttonClasses,
  cx,
  type Tone,
} from "../ui/primitives";

const STAGE_TONE: Record<string, Tone> = {
  lead_identified: "neutral",
  contact_confirmed: "ink",
  legal_identity_reviewed: "teal",
  capabilities_documented: "ok",
};

type SortKey = "name" | "city" | "stage" | "due" | "activity";

function dueCount(s: OpsSupplier) {
  return checksDue(s.checks, OPS_TODAY).length;
}

function hasGrant(s: OpsSupplier) {
  return s.permissions.some(
    (p) => p.revokedAt === null && (p.expiresAt === null || p.expiresAt >= OPS_TODAY),
  );
}

export function OpsSupplierList() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [family, setFamily] = useState<string>("all");
  const [onlyDue, setOnlyDue] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "activity",
    dir: "desc",
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = OPS_SUPPLIERS.filter((s) => {
      if (q && !`${s.legalNameZh} ${s.nameEn} ${s.city}`.toLowerCase().includes(q)) return false;
      if (stage !== "all" && s.stage !== stage) return false;
      if (family !== "all" && !s.families.includes(family)) return false;
      if (onlyDue && dueCount(s) === 0) return false;
      if (onlyMine && s.assignedProjects.length === 0) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return dir * a.nameEn.localeCompare(b.nameEn);
        case "city":
          return dir * a.city.localeCompare(b.city);
        case "stage":
          return dir * (STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
        case "due":
          return dir * (dueCount(a) - dueCount(b));
        case "activity":
          return dir * a.lastActivity.localeCompare(b.lastActivity);
      }
    });
  }, [query, stage, family, onlyDue, onlyMine, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={cx("px-4 py-2 font-medium", align === "right" ? "text-right" : "text-left")}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={cx(
            "inline-flex items-center gap-1 hover:text-(--fbg-text-primary)",
            active && "text-(--fbg-text-primary)",
          )}
        >
          {label}
          <Icon
            name="chevron-down"
            size={12}
            className={cx(!active && "opacity-30", active && sort.dir === "asc" && "rotate-180")}
          />
        </button>
      </th>
    );
  };

  const totalDue = OPS_SUPPLIERS.reduce((n, s) => n + dueCount(s), 0);

  return (
    <AppShell workspace="ops" title="Suppliers">
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="lock" title="Internal workspace">
          Supplier contacts are visible only to operators assigned to a project with that supplier.
          Research leads are internal market observations, never supplier offers.
        </Notice>
        <PageHeader
          title="Suppliers"
          lead="Private supplier intelligence from authorized materials and direct contact. Stage is earned by records: contacted ≠ identity reviewed ≠ product tested ≠ batch inspected."
          meta={
            <>
              <Badge tone="neutral" icon={null} className="fbg-num">
                {OPS_SUPPLIERS.length} suppliers
              </Badge>
              <Badge tone={totalDue > 0 ? "warn" : "ok"} icon="clock" className="fbg-num">
                {totalDue} checks due or overdue
              </Badge>
            </>
          }
          actions={
            <>
              <Button icon="search" title="Research inbox arrives with B-09">
                Research inbox
              </Button>
              <Button variant="primary" icon="plus" title="Create supplier arrives with B-09">
                New supplier
              </Button>
            </>
          }
        />

        <Panel padded={false}>
          <div className="flex flex-col gap-3 border-b border-(--fbg-border-subtle) p-4 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-(--fbg-text-secondary)"
              />
              <TextInput
                aria-label="Search suppliers"
                placeholder="Name or city"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
              <Select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="all">All stages</option>
                {STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Family"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
              >
                <option value="all">All families</option>
                {["Labels", "Folding cartons", "Hair bundles"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              <button
                type="button"
                aria-pressed={onlyDue}
                onClick={() => setOnlyDue((v) => !v)}
                className={cx(
                  "h-9 rounded-(--fbg-radius-control) border px-3 text-sm",
                  onlyDue
                    ? "border-(--fbg-action-primary) bg-(--fbg-selected)"
                    : "border-(--fbg-border-subtle) text-(--fbg-text-secondary)",
                )}
              >
                Checks due
              </button>
              <button
                type="button"
                aria-pressed={onlyMine}
                onClick={() => setOnlyMine((v) => !v)}
                className={cx(
                  "h-9 rounded-(--fbg-radius-control) border px-3 text-sm",
                  onlyMine
                    ? "border-(--fbg-action-primary) bg-(--fbg-selected)"
                    : "border-(--fbg-border-subtle) text-(--fbg-text-secondary)",
                )}
              >
                Assigned to me
              </button>
            </div>
          </div>

          {/* Table (md+) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
                <tr>
                  {header("name", "Supplier")}
                  {header("city", "City")}
                  {header("stage", "Stage")}
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Families
                  </th>
                  {header("due", "Checks due", "right")}
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Catalog grant
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Assigned
                  </th>
                  {header("activity", "Last activity", "right")}
                </tr>
              </thead>
              <tbody className="divide-y divide-(--fbg-border-subtle)">
                {rows.map((s) => {
                  const due = dueCount(s);
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-(--fbg-hover) [&>td]:px-4 [&>td]:py-3 [&>td]:align-top"
                    >
                      <td>
                        <Link
                          href={`/design-preview/ops/supplier?id=${s.id}`}
                          className="font-medium text-(--fbg-text-primary) hover:text-(--fbg-link) hover:underline"
                        >
                          {s.nameEn}
                        </Link>
                        <span
                          className="fbg-zh block text-xs text-(--fbg-text-secondary)"
                          lang="zh-CN"
                        >
                          {s.legalNameZh}
                        </span>
                      </td>
                      <td className="text-(--fbg-text-primary)">{s.city}</td>
                      <td>
                        <Badge tone={STAGE_TONE[s.stage] ?? "neutral"}>
                          {STAGE_LABEL[s.stage]}
                        </Badge>
                      </td>
                      <td className="text-(--fbg-text-secondary)">{s.families.join(", ")}</td>
                      <td className="fbg-num text-right">
                        {due > 0 ? (
                          <Badge tone="warn" icon="clock">
                            {due}
                          </Badge>
                        ) : (
                          <span className="text-(--fbg-text-secondary)">0</span>
                        )}
                      </td>
                      <td>
                        {hasGrant(s) ? (
                          <Badge tone="ok" icon="check">
                            Active
                          </Badge>
                        ) : (
                          <span className="text-xs text-(--fbg-text-secondary)">
                            None — internal only
                          </span>
                        )}
                      </td>
                      <td>
                        {s.assignedProjects.length > 0 ? (
                          <Badge tone="teal" icon="user">
                            You, {s.assignedProjects.length} project
                            {s.assignedProjects.length === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-(--fbg-text-secondary)">Not assigned</span>
                        )}
                      </td>
                      <td className="fbg-num text-right text-(--fbg-text-secondary)">
                        {s.lastActivity}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-(--fbg-text-secondary)"
                    >
                      No suppliers match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Cards (phone) */}
          <ul className="divide-y divide-(--fbg-border-subtle) md:hidden">
            {rows.map((s) => {
              const due = dueCount(s);
              return (
                <li key={s.id} className="flex flex-col gap-2 px-4 py-3">
                  <Link
                    href={`/design-preview/ops/supplier?id=${s.id}`}
                    className="text-[15px] font-medium text-(--fbg-text-primary)"
                  >
                    {s.nameEn}
                  </Link>
                  <p className="fbg-zh text-xs text-(--fbg-text-secondary)" lang="zh-CN">
                    {s.legalNameZh} · {s.city}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={STAGE_TONE[s.stage] ?? "neutral"}>{STAGE_LABEL[s.stage]}</Badge>
                    {due > 0 ? (
                      <Badge tone="warn" icon="clock" className="fbg-num">
                        {due} due
                      </Badge>
                    ) : null}
                    {hasGrant(s) ? <Badge tone="ok">Grant active</Badge> : null}
                    {s.assignedProjects.length > 0 ? (
                      <Badge tone="teal" icon="user">
                        Assigned
                      </Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--fbg-border-subtle) px-4 py-2.5 text-xs text-(--fbg-text-secondary)">
            <span className="fbg-num">
              {rows.length} of {OPS_SUPPLIERS.length} shown · sorted by {sort.key} {sort.dir}
            </span>
            <Link href="/design-preview/ops/quote-review" className={buttonClasses("ghost", "sm")}>
              Quotes awaiting review
            </Link>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
