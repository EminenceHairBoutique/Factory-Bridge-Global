/**
 * Field names, limits and product-family labels for the public sourcing-request form (B-31). Deliberately free
 * of zod and of anything server-side, because the client form imports it: the validation schema itself stays in
 * src/server/inquiry/schema.ts and never reaches the browser bundle.
 */
export const PRODUCT_FAMILIES = [
  "roll_labels",
  "folding_cartons",
  "hair_bundles",
  "other",
] as const;
export type ProductFamily = (typeof PRODUCT_FAMILIES)[number];

export const PRODUCT_FAMILY_LABEL: Record<ProductFamily, string> = {
  roll_labels: "Custom roll labels",
  folding_cartons: "Folding cartons",
  hair_bundles: "Human-hair bundles",
  other: "Something else",
};

export const INQUIRY_LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  quantity: 120,
  messageMin: 20,
  messageMax: 1500,
} as const;

export const INQUIRY_FIELDS = [
  "name",
  "email",
  "company",
  "productFamily",
  "quantity",
  "message",
  "consent",
] as const;
export type InquiryField = (typeof INQUIRY_FIELDS)[number];

/** The values echoed back to the form after an unsuccessful submission, so nothing the visitor typed is lost. */
export type InquiryValues = Partial<Record<InquiryField, string>>;
