import { SupplierQuotes } from "@/design-preview/screens/SupplierQuotes";

export const metadata = { title: "我的报价 — 供应商工作台设计预览（演示数据）" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { group } = await searchParams;
  return <SupplierQuotes initialGroupId={typeof group === "string" ? group : undefined} />;
}
