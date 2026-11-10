import { SupplierProduction } from "@/design-preview/screens/SupplierProduction";

export const metadata = { title: "生产与质检 — 供应商工作台设计预览（演示数据）" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { order } = await searchParams;
  return <SupplierProduction initialOrderId={typeof order === "string" ? order : undefined} />;
}
