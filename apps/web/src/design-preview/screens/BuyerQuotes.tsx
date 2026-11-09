"use client";

/**
 * Buyer Quotes — the scoped landing the "Quotes" destination opens (UX-03 §5).
 * Quotes are compared inside a project, like for like, so this page shows the organization-wide status
 * counts (moved here from the Overview) and where each project's quotes stand, with the one comparison
 * that exists in the prototype linked. A single cross-project list of quotations needs the permissioned
 * quote query (handoff H-34) and is stated as missing rather than faked.
 */
import Link from "next/link";
import { useMemo } from "react";
import { DEMO_AS_OF, DEMO_PROJECTS, DEMO_QUOTES, type DemoProject } from "../demo-data";
import { projectRoutes, quoteStatusSummary } from "../projects-demo";
import { AppShell } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import {
  Badge,
  Notice,
  PageHeader,
  Panel,
  Section,
  buttonClasses,
  cx,
  type Tone,
} from "../ui/primitives";

function projectQuoteState(p: DemoProject): { label: string; tone: Tone; icon: IconName | null } {
  if (p.stage === "comparison_ready" || p.stage === "handoff_pending") {
    return { label: "Comparison ready", tone: "teal", icon: "check" };
  }
  if (p.quotes.inReview > 0) {
    return {
      label: `${p.quotes.inReview} awaiting your review`,
      tone: "warn",
      icon: "eye",
    };
  }
  if (p.quotes.confirmed > 0) return { label: "Quotes confirmed", tone: "ok", icon: "check" };
  return { label: "No quotes yet", tone: "neutral", icon: null };
}

export function BuyerQuotes() {
  const status = useMemo(() => quoteStatusSummary(DEMO_PROJECTS, DEMO_QUOTES, DEMO_AS_OF), []);
  const projects = useMemo(
    () => [...DEMO_PROJECTS].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [],
  );

  const tiles: Array<{ label: string; value: number; tone: Tone; icon: IconName | null }> = [
    { label: "Factory-confirmed", value: status.confirmed, tone: "ok", icon: null },
    { label: "Awaiting your review", value: status.inReview, tone: "neutral", icon: null },
    { label: "Expiring within 60 days", value: status.expiring, tone: "warn", icon: "clock" },
    { label: "Validity unconfirmed", value: status.unconfirmed, tone: "warn", icon: "alert" },
    { label: "Expired", value: status.expired, tone: "danger", icon: "alert" },
  ];

  return (
    <AppShell workspace="buyer" title="Quotes">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <PageHeader
          title="Quotes"
          lead="Quotes are compared inside each project, like for like. This page shows where every project's quotes stand."
          meta={
            <span className="fbg-num">As of {DEMO_AS_OF} · counts come from the quote records</span>
          }
          actions={
            <Link
              href="/design-preview/buyer/documents#upload"
              className={buttonClasses("primary")}
            >
              <Icon name="upload" size={16} />
              Upload a quote
            </Link>
          }
        />

        <Panel padded={false}>
          <dl className="grid grid-cols-2 sm:grid-cols-5">
            {tiles.map((t, i) => (
              <div
                key={t.label}
                className={cx(
                  "px-4 py-3",
                  i > 0 && "border-l border-(--fbg-border-divider)",
                  i >= 2 && "border-t border-(--fbg-border-divider) sm:border-t-0",
                  i === 2 && "border-l-0 sm:border-l",
                  i === 4 && "col-span-2 border-l-0 sm:col-span-1 sm:border-l",
                )}
              >
                <dt className="text-[12px] text-(--fbg-text-secondary)">{t.label}</dt>
                <dd
                  className={cx(
                    "fbg-num mt-0.5 flex items-center gap-1.5 text-[18px] leading-7 font-semibold",
                    t.value > 0 && t.tone === "warn" && "text-(--fbg-status-warning)",
                    t.value > 0 && t.tone === "danger" && "text-(--fbg-status-danger)",
                    (t.value === 0 || t.tone === "ok" || t.tone === "neutral") &&
                      "text-(--fbg-text-primary)",
                  )}
                >
                  {t.value}
                  {t.icon && t.value > 0 ? <Icon name={t.icon} size={14} /> : null}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Section id="by-project" title="By project">
          <Panel padded={false}>
            <ul className="divide-y divide-(--fbg-border-divider)">
              {projects.map((p) => {
                const state = projectQuoteState(p);
                const routes = projectRoutes(p.id);
                const action = routes.compare ? (
                  <Link href={routes.compare} className={buttonClasses("secondary", "sm")}>
                    Open comparison
                  </Link>
                ) : p.quotes.inReview > 0 ? (
                  <Link
                    href="/design-preview/buyer/documents"
                    className={buttonClasses("secondary", "sm")}
                  >
                    Review documents
                  </Link>
                ) : routes.nextAction ? (
                  <Link href={routes.nextAction} className={buttonClasses("secondary", "sm")}>
                    {p.nextAction}
                  </Link>
                ) : null;
                return (
                  <li
                    key={p.id}
                    className="grid gap-x-4 gap-y-2 px-4 py-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-(--fbg-text-primary)">
                        {routes.record ? (
                          <Link
                            href={routes.record}
                            className="hover:text-(--fbg-link) hover:underline"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </p>
                      <p className="truncate text-[12px] text-(--fbg-text-secondary)">{p.family}</p>
                    </div>
                    <p className="fbg-num text-[13px] text-(--fbg-text-secondary)">
                      {p.quotes.confirmed + p.quotes.inReview === 0 ? (
                        "No quotes received"
                      ) : (
                        <>
                          {p.quotes.confirmed} confirmed
                          {p.quotes.inReview > 0 ? `, ${p.quotes.inReview} in review` : ""}
                          {p.quotes.expiringSoon > 0 ? (
                            <span className="text-(--fbg-status-warning)">
                              , {p.quotes.expiringSoon} expiring soon
                            </span>
                          ) : null}
                        </>
                      )}
                    </p>
                    <div>
                      <Badge tone={state.tone} icon={state.icon}>
                        {state.label}
                      </Badge>
                    </div>
                    <div className="lg:justify-self-end">{action}</div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </Section>

        <Notice tone="neutral" title="One list of every quotation is not in this prototype">
          It needs the permissioned cross-project quote query (handoff H-34 in the UX-03 report).
          Until then each quotation is reached through its project, where its type, trade term,
          validity and evidence are shown next to the price.
        </Notice>
      </div>
    </AppShell>
  );
}
