import { OpsPipelineBoard } from "@/design-preview/screens/OpsPipelineBoard";

export const metadata = { title: "Pipeline — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { project } = await searchParams;
  return <OpsPipelineBoard initialProjectId={typeof project === "string" ? project : undefined} />;
}
