import { BuyerLandedCost } from "@/design-preview/screens/BuyerLandedCost";

export const metadata = { title: "Landed cost scenarios — design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { snapshot } = await searchParams;
  return (
    <BuyerLandedCost initialSnapshotId={typeof snapshot === "string" ? snapshot : undefined} />
  );
}
