import { SupplierPricing } from "@/design-preview/screens/SupplierPricing";

export const metadata = { title: "阶梯报价 — 供应商工作台设计预览（演示数据）" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { product } = await searchParams;
  return <SupplierPricing productId={typeof product === "string" ? product : undefined} />;
}
