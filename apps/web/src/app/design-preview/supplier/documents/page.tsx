import { SupplierDocuments } from "@/design-preview/screens/SupplierDocuments";

export const metadata = { title: "文件资料 — 供应商工作台设计预览（演示数据）" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { doc, upload } = await searchParams;
  return (
    <SupplierDocuments
      initialDocId={typeof doc === "string" ? doc : undefined}
      initialUploadKey={typeof upload === "string" ? upload : undefined}
    />
  );
}
