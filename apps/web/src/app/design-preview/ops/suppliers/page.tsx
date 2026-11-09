import { OpsSupplierList } from "@/design-preview/screens/OpsSupplierList";

export const metadata = { title: "Suppliers — operations design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { new: isNew, lead } = await searchParams;
  return (
    <OpsSupplierList
      initialNew={isNew === "1"}
      leadId={typeof lead === "string" ? lead : undefined}
    />
  );
}
