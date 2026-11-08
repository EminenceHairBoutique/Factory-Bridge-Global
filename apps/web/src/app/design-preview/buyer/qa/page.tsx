import { BuyerQaStatus } from "@/design-preview/screens/BuyerQaStatus";

export const metadata = { title: "Samples and inspections — design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { track } = await searchParams;
  return <BuyerQaStatus initialTrackId={typeof track === "string" ? track : undefined} />;
}
