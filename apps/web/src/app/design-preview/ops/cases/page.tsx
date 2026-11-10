import { OpsBuyerCases } from "@/design-preview/screens/OpsBuyerCases";

export const metadata = { title: "Buyer cases — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { case: caseId } = await searchParams;
  return <OpsBuyerCases initialCaseId={typeof caseId === "string" ? caseId : undefined} />;
}
