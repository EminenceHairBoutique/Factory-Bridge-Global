import { OpsResearchInbox } from "@/design-preview/screens/OpsResearchInbox";

export const metadata = { title: "Research inbox — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lead } = await searchParams;
  return <OpsResearchInbox initialLeadId={typeof lead === "string" ? lead : undefined} />;
}
