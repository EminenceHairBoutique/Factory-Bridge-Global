import { parseProjectTab } from "@/design-preview/projects-demo";
import { ProjectOverview } from "@/design-preview/screens/ProjectOverview";

export const metadata = { title: "Project overview — design preview (demo data)" };

/** `?tab=options|activity|messages|…` opens the record on that tab (deep links from the Overview). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tab = parseProjectTab((await searchParams).tab);
  return <ProjectOverview key={tab} initialTab={tab} />;
}
