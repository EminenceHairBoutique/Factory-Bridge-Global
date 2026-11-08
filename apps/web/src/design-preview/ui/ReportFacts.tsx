"use client";

/**
 * Reproducibility facts for one comparison report: the inputs it recorded (brief version,
 * quantity, as-of date, FX row, engine, exact quotation versions) and why it is current, stale or
 * superseded. Shared by the reports list (evidence drawer) and the report viewer.
 */
import { DEMO_FX } from "../demo-data";
import { FORMAT_LABEL, type ReportRecord } from "../demo-data/reports";
import { formatQty } from "../compare-demo";
import { REPORT_STATE_LABEL, REPORT_STATE_TONE, type ReportStatus } from "../reports-demo";
import { Badge, KeyValue } from "./primitives";

export function ReportFacts({
  report,
  status,
  unit,
}: {
  report: ReportRecord;
  status: ReportStatus;
  unit: string;
}) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="min-w-0">
        <p className="text-xs text-(--fbg-text-secondary)">Report v{report.version}</p>
        <p className="fbg-num text-[15px] font-semibold break-all text-(--fbg-text-primary)">
          {report.fileName}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge
            tone={report.state === "generating" ? "teal" : REPORT_STATE_TONE[status.state]}
            icon={
              report.state === "generating" ? "clock" : status.state === "stale" ? "alert" : null
            }
          >
            {report.state === "generating" ? "Generating" : REPORT_STATE_LABEL[status.state]}
          </Badge>
          <span className="text-xs text-(--fbg-text-secondary)">{FORMAT_LABEL[report.format]}</span>
        </div>
        {status.reasons.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
            {status.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-(--fbg-text-secondary)">
            The brief and every quotation it used are unchanged since generation.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Inputs recorded</p>
        <div className="mt-2">
          <KeyValue
            columns={1}
            items={[
              { label: "Brief", value: `v${report.briefVersion}` },
              {
                label: "Quantity",
                value: <span className="fbg-num">{`${formatQty(report.quantity)} ${unit}`}</span>,
              },
              { label: "As of", value: <span className="fbg-num">{report.asOf}</span> },
              {
                label: "FX row",
                value: (
                  <span className="fbg-num">
                    {report.fxRateId} · {(1 / DEMO_FX.rate).toFixed(2)} CNY/USD · {DEMO_FX.rateDate}{" "}
                    · {DEMO_FX.source}
                  </span>
                ),
              },
              { label: "Engine", value: report.engineVersion },
              {
                label: "Freight estimate",
                value: report.includeForwarder
                  ? "Forwarder estimate included; lines marked estimated"
                  : "Not included; freight lines missing",
              },
              {
                label: "Generated",
                value: (
                  <span className="fbg-num">
                    {report.generatedAt} · {report.generatedBy}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">
          Quotation versions used ({report.quotations.length})
        </p>
        <ul className="mt-1 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
          {report.quotations.map((q) => (
            <li key={q.id} className="fbg-num">
              {q.supplier} · {q.id} v{q.version} · confirmed {q.confirmedAt}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Every row in the file carries the quotation id, its confirmation date, the original
          currency and the FX row, so the file stays reproducible after later changes.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Redaction</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Supplier contact details are not in the file. They appear only when your organization
          holds a recorded disclosure grant.
        </p>
      </div>
    </div>
  );
}
