"use client";

/**
 * Brief & Spec Builder — confirmation (IA §2.2 `/app/projects/[id]/brief`; PRD AC-B1.2, AC-B1.3; BACKLOG B-17).
 * Three things side by side: the raw input, the AI proposal with per-field provenance, and the buyer's decision.
 * Nothing marked `inferred` or `missing` is used for matching until the buyer confirms it. Local state only.
 */
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  BRIEF_PROJECT,
  BRIEF_PROPOSAL,
  BRIEF_RAW_INPUT,
  BRIEF_VERSIONS,
  GROUP_LABEL,
  type ProposedField,
  type Provenance,
} from "../demo-data/brief";
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

const TODAY_AT = "2026-11-07 10:12";

const PROVENANCE: Record<Provenance, { label: string; tone: Tone; hint: string }> = {
  from_input: { label: "from input", tone: "teal", hint: "Taken from your words" },
  inferred: { label: "inferred", tone: "warn", hint: "Not used for matching until you confirm it" },
  missing: { label: "missing", tone: "danger", hint: "Not stated; needed or optional as marked" },
};

type DecisionStatus = "confirmed" | "pending" | "unknown" | "skipped";
type DecisionSource = "from_input" | "accepted" | "edited" | "unknown" | "skipped";

interface Decision {
  status: DecisionStatus;
  source: DecisionSource;
  value: string | null;
  previous?: string | null | undefined;
}

interface Version {
  version: number;
  kind: "raw_input" | "ai_proposal" | "confirmed";
  label: string;
  at: string;
  by: string;
  note: string;
}

function initialDecisions(): Record<string, Decision> {
  return Object.fromEntries(
    BRIEF_PROPOSAL.map((f) => [
      f.key,
      f.provenance === "from_input"
        ? { status: "confirmed", source: "from_input", value: f.value }
        : { status: "pending", source: "from_input", value: f.value },
    ]),
  );
}

/** Raw text with the supporting snippets marked; the active field's snippet is emphasised. */
function RawText({ activeKey }: { activeKey: string | null }) {
  const segments = useMemo(() => {
    const text = BRIEF_RAW_INPUT.text;
    const marks = BRIEF_PROPOSAL.filter((f) => f.snippet)
      .map((f) => ({
        key: f.key,
        start: text.indexOf(f.snippet as string),
        len: (f.snippet as string).length,
      }))
      .filter((m) => m.start >= 0)
      .sort((a, b) => a.start - b.start);
    const out: Array<{ text: string; key: string | null }> = [];
    let cursor = 0;
    for (const m of marks) {
      if (m.start < cursor) continue; // overlapping snippet: keep the earlier mark
      if (m.start > cursor) out.push({ text: text.slice(cursor, m.start), key: null });
      out.push({ text: text.slice(m.start, m.start + m.len), key: m.key });
      cursor = m.start + m.len;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), key: null });
    return out;
  }, []);
  return (
    <p className="text-[15px] leading-7 text-(--fbg-text-primary)">
      {segments.map((s, i) =>
        s.key ? (
          <mark
            key={i}
            data-key={s.key}
            className={cx(
              "rounded px-0.5 text-(--fbg-text-primary)",
              s.key === activeKey
                ? "bg-(--fbg-action-primary)/25 ring-1 ring-(--fbg-action-primary)"
                : "bg-(--fbg-accent-subtle)",
            )}
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}

export function BriefConfirmation() {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(initialDecisions);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>(BRIEF_VERSIONS);
  const [confirmedVersion, setConfirmedVersion] = useState<number | null>(null);
  const [optionsRequested, setOptionsRequested] = useState(false);

  const pending = BRIEF_PROPOSAL.filter((f) => decisions[f.key]?.status === "pending");
  const pendingInferred = pending.filter((f) => f.provenance === "inferred").length;
  const pendingMissing = pending.filter((f) => f.provenance === "missing").length;
  const hardUnknown = BRIEF_PROPOSAL.filter(
    (f) => f.hard && decisions[f.key]?.status === "unknown",
  );
  const decided = BRIEF_PROPOSAL.length - pending.length;
  const canConfirm = pending.length === 0 && confirmedVersion === null;
  const current = versions[versions.length - 1];

  const set = (key: string, d: Decision) => setDecisions((m) => ({ ...m, [key]: d }));

  const lastConfirmed = [...versions].reverse().find((v) => v.kind === "confirmed") ?? null;
  const nextVersion = (current?.version ?? 2) + (confirmedVersion ? 0 : 1);

  const startEdit = (f: ProposedField) => {
    if (confirmedVersion !== null) {
      // Editing a confirmed brief opens a draft of the next version; the confirmed version is never overwritten.
      setConfirmedVersion(null);
      setOptionsRequested(false);
    }
    setEditing(f.key);
    setEditValue(decisions[f.key]?.value ?? f.value ?? "");
  };

  const saveEdit = (f: ProposedField) => {
    const prev = decisions[f.key]?.value ?? f.value;
    const next = editValue.trim();
    if (!next) return;
    set(f.key, {
      status: next === "Not sure" || next === "Not sure — advise me" ? "unknown" : "confirmed",
      source:
        next === prev && f.provenance !== "missing"
          ? "accepted"
          : next.startsWith("Not sure")
            ? "unknown"
            : "edited",
      value: next,
      previous: prev,
    });
    setEditing(null);
  };

  const confirmBrief = () => {
    const v = (current?.version ?? 2) + 1;
    setVersions((list) => [
      ...list,
      {
        version: v,
        kind: "confirmed",
        label: "Confirmed by you",
        at: TODAY_AT,
        by: "Demo Buyer",
        note: `${BRIEF_PROPOSAL.filter((f) => decisions[f.key]?.source === "edited").length} edited · ${BRIEF_PROPOSAL.filter((f) => decisions[f.key]?.source === "accepted").length} accepted · ${hardUnknown.length} required value${hardUnknown.length === 1 ? "" : "s"} marked “Not sure”. v1 and v2 remain viewable.`,
      },
    ]);
    setConfirmedVersion(v);
    window.scrollTo({ top: 0 });
  };

  return (
    <AppShell workspace="buyer" title="Brief and specification">
      <div className="flex flex-col gap-6">
        <PageHeader
          title={BRIEF_PROJECT.name}
          lead="Your words become a structured specification in English and Chinese. Values taken from your input are confirmed already; inferred and missing values wait for your decision and are not used for matching until then."
          meta={
            <>
              {confirmedVersion ? (
                <Badge tone="teal" icon="check" className="fbg-num">
                  Brief v{confirmedVersion} confirmed {TODAY_AT}
                </Badge>
              ) : lastConfirmed ? (
                <Badge tone="warn" icon="alert" className="fbg-num">
                  Draft v{nextVersion} — changes since v{lastConfirmed.version}
                </Badge>
              ) : (
                <Badge tone="warn" icon="alert" className="fbg-num">
                  Brief v2 — AI proposal awaiting your confirmation
                </Badge>
              )}
              <Badge tone="neutral" icon="folder">
                {BRIEF_PROJECT.family}
              </Badge>
            </>
          }
          actions={
            <>
              <Button
                icon="search"
                title="Re-structuring creates a new proposal version; arrives with B-17"
              >
                Re-run structuring
              </Button>
              <Button
                variant="primary"
                icon="check"
                disabled={!canConfirm}
                title={
                  confirmedVersion
                    ? "Already confirmed"
                    : pending.length > 0
                      ? `${pending.length} value${pending.length === 1 ? "" : "s"} still need a decision`
                      : undefined
                }
                onClick={confirmBrief}
              >
                Confirm brief as v{nextVersion}
              </Button>
            </>
          }
        />

        {/* Progress / outcome */}
        {confirmedVersion ? (
          <Notice
            tone="ok"
            title={`Brief v${confirmedVersion} confirmed`}
            action={
              optionsRequested ? (
                <Badge tone="teal" icon="check">
                  Sent to operations for assignment. No supplier is contacted until you approve the
                  outbound request.
                </Badge>
              ) : (
                <Button
                  variant="primary"
                  icon="building"
                  disabled={hardUnknown.length > 0}
                  title={
                    hardUnknown.length > 0
                      ? `Resolve “Not sure” on: ${hardUnknown.map((f) => f.label).join(", ")}`
                      : undefined
                  }
                  onClick={() => setOptionsRequested(true)}
                >
                  Request supplier options
                </Button>
              )
            }
          >
            Hard attributes are now locked for exact matching. Versions 1 and 2 stay viewable in the
            timeline.
            {hardUnknown.length > 0
              ? ` Supplier options cannot be requested while a required attribute is “Not sure”: ${hardUnknown.map((f) => f.label).join(", ")}. An operator will ask you.`
              : ""}
          </Notice>
        ) : (
          <Notice
            tone={pending.length === 0 ? "ok" : "warn"}
            title={`${decided} of ${BRIEF_PROPOSAL.length} values decided`}
          >
            {pending.length === 0
              ? `Everything has a decision. Confirm the brief to create version ${nextVersion}${lastConfirmed ? `; version ${lastConfirmed.version} stays unchanged` : ""}.`
              : `${pendingInferred} inferred and ${pendingMissing} missing value${pendingInferred + pendingMissing === 1 ? "" : "s"} need you. Accept, edit, or mark “Not sure”; a required attribute marked “Not sure” blocks supplier options until resolved.`}
          </Notice>
        )}

        <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
          {/* Raw input + versions */}
          <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
            <Panel
              title="Your input (v1)"
              description={`Submitted ${BRIEF_RAW_INPUT.submittedAt} by ${BRIEF_RAW_INPUT.submittedBy}. Highlights show which words each value came from.`}
            >
              <RawText activeKey={activeKey} />
              <p className="mt-3 text-xs text-(--fbg-text-secondary)">
                中文描述：未提供（Chinese description: none provided）
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {BRIEF_RAW_INPUT.attachments.map((a) => (
                  <li
                    key={a.name}
                    className="flex items-center gap-2 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) px-3 py-2 text-sm"
                  >
                    <Icon name="camera" size={14} className="text-(--fbg-text-secondary)" />
                    <span className="fbg-num">{a.name}</span>
                    <Badge tone="ok" icon="shield">
                      Scanned
                    </Badge>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              title="Versions"
              description="Each version is stored with its timestamp; none is overwritten."
              padded={false}
            >
              <ol className="divide-y divide-(--fbg-border-subtle)">
                {versions.map((v) => {
                  const isCurrent = v.version === current?.version;
                  return (
                    <li key={v.version} className="flex gap-3 px-5 py-3">
                      <span
                        className={cx(
                          "fbg-num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          v.kind === "confirmed"
                            ? "bg-(--fbg-action-primary) text-(--fbg-action-on-primary)"
                            : "bg-(--fbg-hover) text-(--fbg-text-secondary)",
                        )}
                      >
                        {v.version}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-(--fbg-text-primary)">
                          {v.label}
                          {isCurrent ? (
                            <Badge tone="ink" icon={null}>
                              current
                            </Badge>
                          ) : null}
                        </p>
                        <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                          {v.at} · {v.by}
                        </p>
                        <p className="mt-0.5 text-xs text-(--fbg-text-secondary)">{v.note}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </div>

          {/* Proposal + decisions */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="hidden grid-cols-[1.1fr_1fr_1.3fr] gap-4 px-5 text-xs text-(--fbg-text-secondary) md:grid">
              <span>Field and where it came from</span>
              <span>AI proposal (v2) · 中文</span>
              <span>Your decision (v{nextVersion})</span>
            </div>
            {(Object.keys(GROUP_LABEL) as ProposedField["group"][]).map((group) => (
              <Panel key={group} title={GROUP_LABEL[group]} padded={false}>
                <ul className="divide-y divide-(--fbg-border-subtle)">
                  {BRIEF_PROPOSAL.filter((f) => f.group === group).map((f) => {
                    const d = decisions[f.key] ?? {
                      status: "pending",
                      source: "from_input",
                      value: f.value,
                    };
                    const p = PROVENANCE[f.provenance];
                    const isEditing = editing === f.key;
                    return (
                      <li
                        key={f.key}
                        className={cx(
                          "grid gap-3 px-5 py-4 md:grid-cols-[1.1fr_1fr_1.3fr] md:gap-4",
                          activeKey === f.key && "bg-(--fbg-hover)",
                        )}
                        onMouseEnter={() => setActiveKey(f.key)}
                        onMouseLeave={() => setActiveKey((k) => (k === f.key ? null : k))}
                        onFocusCapture={() => setActiveKey(f.key)}
                      >
                        {/* Field + provenance */}
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-(--fbg-text-primary)">
                            {f.label}
                            {f.hard ? (
                              <Badge tone="ink" icon={null}>
                                required for matching
                              </Badge>
                            ) : null}
                          </p>
                          <p className="mt-1">
                            <Badge tone={p.tone} title={p.hint}>
                              {p.label}
                            </Badge>
                          </p>
                          {f.snippet ? (
                            <p className="mt-1.5 text-xs text-(--fbg-text-secondary)">
                              From:{" "}
                              <span className="rounded bg-(--fbg-accent-subtle) px-1 text-(--fbg-text-primary)">
                                “{f.snippet}”
                              </span>
                            </p>
                          ) : null}
                          {f.reasoning ? (
                            <p className="mt-1 text-xs text-(--fbg-text-secondary)">
                              {f.reasoning}
                            </p>
                          ) : null}
                        </div>

                        {/* Proposal EN + ZH */}
                        <div className="min-w-0">
                          {f.value ? (
                            <>
                              <p className="fbg-num text-[15px] text-(--fbg-text-primary)">
                                {f.value}
                              </p>
                              <p
                                className="fbg-zh fbg-num mt-0.5 text-sm text-(--fbg-text-secondary)"
                                lang="zh-CN"
                              >
                                {f.labelZh}：{f.valueZh}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[15px] text-(--fbg-status-danger)">Not stated</p>
                              <p
                                className="fbg-zh mt-0.5 text-sm text-(--fbg-text-secondary)"
                                lang="zh-CN"
                              >
                                {f.labelZh}：未提供
                              </p>
                            </>
                          )}
                        </div>

                        {/* Decision */}
                        <div className="min-w-0">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              {f.options ? (
                                <Select
                                  aria-label={`${f.label} value`}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                >
                                  {!f.options.includes(editValue) && editValue ? (
                                    <option value={editValue}>{editValue}</option>
                                  ) : null}
                                  {f.options.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <TextInput
                                  aria-label={`${f.label} value`}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="fbg-num"
                                />
                              )}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => saveEdit(f)}
                                  disabled={!editValue.trim()}
                                >
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : d.status === "pending" ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs text-(--fbg-status-warning)">
                                {f.provenance === "inferred"
                                  ? "Needs your decision"
                                  : f.hard
                                    ? "Needed for matching"
                                    : "Optional, not stated"}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {f.value ? (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    icon="check"
                                    onClick={() =>
                                      set(f.key, {
                                        status: "confirmed",
                                        source: "accepted",
                                        value: f.value,
                                      })
                                    }
                                  >
                                    Accept
                                  </Button>
                                ) : null}
                                <Button size="sm" onClick={() => startEdit(f)}>
                                  {f.value ? "Edit" : "Provide"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    set(
                                      f.key,
                                      f.hard
                                        ? {
                                            status: "unknown",
                                            source: "unknown",
                                            value: "Not sure",
                                            previous: f.value,
                                          }
                                        : {
                                            status: "skipped",
                                            source: "skipped",
                                            value: null,
                                            previous: f.value,
                                          },
                                    )
                                  }
                                >
                                  {f.hard ? "Not sure" : "Skip"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <DecisionSummary
                              d={d}
                              onEdit={() => startEdit(f)}
                              confirmed={confirmedVersion !== null}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            ))}

            <p className="text-xs text-(--fbg-text-secondary)">
              Confirmed values are stored as a new brief version with your name and time; the AI
              proposal is kept unchanged. Go back to the{" "}
              <Link
                href="/design-preview/buyer/dashboard"
                className={cx(
                  buttonClasses("ghost", "sm"),
                  "h-auto px-1 py-0 text-xs text-(--fbg-link) underline",
                )}
              >
                overview
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DecisionSummary({
  d,
  onEdit,
  confirmed,
}: {
  d: Decision;
  onEdit: () => void;
  confirmed: boolean;
}) {
  let badge: ReactNode;
  switch (d.status) {
    case "confirmed":
      badge =
        d.source === "from_input" ? (
          <Badge tone="teal" icon="check">
            Confirmed from your input
          </Badge>
        ) : d.source === "accepted" ? (
          <Badge tone="ok" icon="check">
            Accepted by you
          </Badge>
        ) : (
          <Badge tone="ok" icon="check">
            Edited by you
          </Badge>
        );
      break;
    case "unknown":
      badge = (
        <Badge tone="warn" icon="alert">
          Not sure — an operator will ask you
        </Badge>
      );
      break;
    case "skipped":
      badge = (
        <Badge tone="neutral" icon={null}>
          Skipped (optional)
        </Badge>
      );
      break;
    case "pending":
      badge = null;
      break;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="fbg-num text-[15px] text-(--fbg-text-primary)">{d.value ?? "—"}</p>
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        {d.source === "edited" && d.previous ? (
          <span className="text-xs text-(--fbg-text-secondary)">
            was <span className="line-through">{d.previous}</span>
          </span>
        ) : null}
      </div>
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          title={
            confirmed ? "Editing a confirmed brief opens a draft of the next version" : undefined
          }
        >
          {d.status === "unknown" || d.status === "skipped" ? "Provide a value" : "Edit"}
        </Button>
      </div>
    </div>
  );
}
