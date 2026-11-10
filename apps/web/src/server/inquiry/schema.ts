/**
 * Public sourcing-request (pilot inquiry) input contract — B-31.
 *
 * The only anonymous write path in the web app. Everything a visitor sends is untrusted data: it is validated
 * here with a strict zod schema (unknown keys rejected, every string trimmed and length-capped) before anything
 * else touches it, and it is never logged. Fields are the minimum needed to reply (SECURITY.md T16, data
 * minimization): no phone number, no uploads, no free-form attachments. Server-only: the client form imports the
 * zod-free constants from src/site/inquiry-fields.ts instead, so zod and this schema stay out of the browser.
 */
import { z } from "zod";
import {
  INQUIRY_FIELDS,
  INQUIRY_LIMITS,
  PRODUCT_FAMILIES,
  type InquiryField,
  type InquiryValues,
} from "../../site/inquiry-fields";

export {
  INQUIRY_FIELDS,
  INQUIRY_LIMITS,
  PRODUCT_FAMILIES,
  PRODUCT_FAMILY_LABEL,
  type InquiryField,
  type InquiryValues,
  type ProductFamily,
} from "../../site/inquiry-fields";

/**
 * True when `v` contains ASCII control characters. Multi-line fields may keep tab, LF and CR; single-line fields
 * may not (blocks CR/LF smuggling into anything downstream that treats a value as one line).
 */
export function hasControlChars(v: string, allowLineBreaks: boolean): boolean {
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c === 0x7f) return true;
    if (c < 0x20 && !(allowLineBreaks && (c === 0x09 || c === 0x0a || c === 0x0d))) return true;
  }
  return false;
}

/** Single-line text: trimmed, no control characters. */
function line(label: string, max: number) {
  return z
    .string({ error: `Enter your ${label}.` })
    .trim()
    .min(1, { error: `Enter your ${label}.` })
    .max(max, { error: `Use ${max} characters or fewer.` })
    .refine((v) => !hasControlChars(v, false), {
      error: "Remove line breaks and special characters.",
    });
}

export const inquirySchema = z.strictObject({
  name: line("name", INQUIRY_LIMITS.name),
  email: z
    .string({ error: "Enter your work email." })
    .trim()
    .min(1, { error: "Enter your work email." })
    .max(INQUIRY_LIMITS.email, { error: "Use 254 characters or fewer." })
    .pipe(z.email({ error: "Enter a valid email address, like name@company.com." })),
  company: line("company name", INQUIRY_LIMITS.company),
  productFamily: z.enum(PRODUCT_FAMILIES, { error: "Choose a product family." }),
  quantity: z
    .string()
    .trim()
    .max(INQUIRY_LIMITS.quantity, { error: "Use 120 characters or fewer." })
    .refine((v) => !hasControlChars(v, false), {
      error: "Remove line breaks and special characters.",
    })
    .optional(),
  message: z
    .string({ error: "Tell us what you need to source." })
    .trim()
    .min(INQUIRY_LIMITS.messageMin, {
      error: `Add a little more detail (at least ${INQUIRY_LIMITS.messageMin} characters).`,
    })
    .max(INQUIRY_LIMITS.messageMax, {
      error: `Use ${INQUIRY_LIMITS.messageMax} characters or fewer.`,
    })
    // Multi-line text is allowed; other control characters are not.
    .refine((v) => !hasControlChars(v, true), {
      error: "Remove special characters.",
    }),
  consent: z.literal("yes", { error: "Confirm that we may contact you about this request." }),
});

export type Inquiry = z.infer<typeof inquirySchema>;

export type ParseResult =
  | { ok: true; inquiry: Inquiry }
  | { ok: false; fieldErrors: Partial<Record<InquiryField, string>>; values: InquiryValues };

/** Raw form fields arrive as strings (or absent). Unknown keys are dropped before parsing. */
export function readInquiryFields(get: (key: string) => unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of INQUIRY_FIELDS) {
    const v = get(key);
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

/** What the visitor typed, capped, for echoing back to the same visitor's form. Never logged or stored. */
export function echoValues(raw: Record<string, string>): InquiryValues {
  const values: InquiryValues = {};
  for (const field of INQUIRY_FIELDS) {
    const v = raw[field];
    if (typeof v === "string") values[field] = v.slice(0, 2000);
  }
  return values;
}

export function parseInquiry(raw: Record<string, string>): ParseResult {
  const input: Record<string, string | undefined> = { ...raw };
  // An empty optional field means "not provided".
  if (input.quantity !== undefined && input.quantity.trim() === "") delete input.quantity;
  const result = inquirySchema.safeParse(input);
  if (result.success) return { ok: true, inquiry: result.data };

  const fieldErrors: Partial<Record<InquiryField, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && (INQUIRY_FIELDS as readonly string[]).includes(key)) {
      const field = key as InquiryField;
      fieldErrors[field] ??= issue.message;
    }
  }
  return { ok: false, fieldErrors, values: echoValues(raw) };
}
