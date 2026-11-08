import {
  BuyerExtractionReview,
  DEFAULT_REVIEW_DOC,
} from "@/design-preview/screens/BuyerExtractionReview";

export const metadata = { title: "Extraction review — buyer design preview (demo data)" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { doc } = await searchParams;
  return <BuyerExtractionReview docId={typeof doc === "string" ? doc : DEFAULT_REVIEW_DOC} />;
}
