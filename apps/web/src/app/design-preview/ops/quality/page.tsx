import { OpsQualityVerification } from "@/design-preview/screens/OpsQualityVerification";

export const metadata = { title: "Quality verification — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { track } = await searchParams;
  return <OpsQualityVerification initialTrackId={typeof track === "string" ? track : undefined} />;
}
