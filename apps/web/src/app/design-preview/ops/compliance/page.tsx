import { OpsComplianceReview } from "@/design-preview/screens/OpsComplianceReview";

export const metadata = { title: "Compliance holds — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { hold } = await searchParams;
  return <OpsComplianceReview initialHoldId={typeof hold === "string" ? hold : undefined} />;
}
