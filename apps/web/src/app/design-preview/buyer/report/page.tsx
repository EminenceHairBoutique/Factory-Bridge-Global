import {
  BuyerReportView,
  DEFAULT_REPORT_ID,
  type LiveReportParams,
} from "@/design-preview/screens/BuyerReportView";
import type { ReportFormat } from "@/design-preview/demo-data/reports";

export const metadata = { title: "Comparison report — buyer design preview (demo data)" };

const FORMATS: ReportFormat[] = ["pdf", "xlsx", "csv"];

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const id = str(params.id) ?? DEFAULT_REPORT_ID;
  const v = Number(str(params.v));
  const qty = Number(str(params.qty));
  const fwd = str(params.fwd);
  const format = str(params.format);
  const live: LiveReportParams = {
    version: Number.isFinite(v) && v > 0 ? v : undefined,
    qty: Number.isFinite(qty) && qty > 0 ? qty : undefined,
    forwarder: fwd === undefined ? undefined : fwd === "1",
    format: format && (FORMATS as string[]).includes(format) ? (format as ReportFormat) : undefined,
  };
  return <BuyerReportView id={id} live={live} />;
}
