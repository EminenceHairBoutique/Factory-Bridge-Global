import { SupplierMessages } from "@/design-preview/screens/SupplierMessages";

export const metadata = { title: "消息 — 供应商工作台设计预览（演示数据）" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { thread } = await searchParams;
  return <SupplierMessages initialThreadId={typeof thread === "string" ? thread : undefined} />;
}
