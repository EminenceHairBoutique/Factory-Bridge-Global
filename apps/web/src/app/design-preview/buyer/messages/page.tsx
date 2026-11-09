import { BuyerMessages } from "@/design-preview/screens/BuyerMessages";

export const metadata = { title: "Messages — buyer design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { thread } = await searchParams;
  return <BuyerMessages initialThreadId={typeof thread === "string" ? thread : undefined} />;
}
