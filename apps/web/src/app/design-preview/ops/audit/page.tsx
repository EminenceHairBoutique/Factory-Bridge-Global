import { OpsAuditExplorer } from "@/design-preview/screens/OpsAuditExplorer";

export const metadata = { title: "Audit explorer — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { event } = await searchParams;
  return <OpsAuditExplorer initialEventId={typeof event === "string" ? event : undefined} />;
}
