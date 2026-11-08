import { SupplierRfqs } from "@/design-preview/screens/SupplierRfqs";

export const metadata = { title: "询价单 — 供应商工作台设计预览（演示数据）" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { rfq } = await searchParams;
  return <SupplierRfqs rfqId={typeof rfq === "string" ? rfq : undefined} />;
}
