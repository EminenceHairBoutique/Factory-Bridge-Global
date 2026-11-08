import { DEFAULT_SUPPLIER_ID, OpsSupplierRecord } from "@/design-preview/screens/OpsSupplierRecord";

export const metadata = { title: "Supplier record — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await searchParams;
  return <OpsSupplierRecord id={typeof id === "string" ? id : DEFAULT_SUPPLIER_ID} />;
}
