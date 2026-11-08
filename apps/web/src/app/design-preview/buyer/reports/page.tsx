import { BuyerReports } from "@/design-preview/screens/BuyerReports";
import type { ReportFormat } from "@/design-preview/demo-data/reports";

export const metadata = { title: "Reports — buyer design preview (demo data)" };

const FORMATS: ReportFormat[] = ["pdf", "xlsx", "csv"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { qty, format } = await searchParams;
  const qtyNumber = typeof qty === "string" ? Number(qty) : undefined;
  return (
    <BuyerReports
      initialQty={Number.isFinite(qtyNumber) ? qtyNumber : undefined}
      initialFormat={
        typeof format === "string" && (FORMATS as string[]).includes(format)
          ? (format as ReportFormat)
          : undefined
      }
    />
  );
}
