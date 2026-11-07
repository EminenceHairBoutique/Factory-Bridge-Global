"use client";

/**
 * New Sourcing Request wizard (IA §2.2 `/app/projects/new`, master spec §6.2, PRD US-B1).
 * Local state only. Files never leave the browser: only name, size and type are kept for display.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Notice,
  PageHeader,
  Panel,
  Select,
  Stepper,
  TextArea,
  TextInput,
  cx,
  type StepDef,
} from "../ui/primitives";

/* ----------------------------------------------------------------------------------------------- */
/* Reference data (pilot families; blocked categories from CLAUDE.md §4)                             */
/* ----------------------------------------------------------------------------------------------- */

type FamilyId = "labels" | "cartons" | "hair" | "other";

interface Category {
  id: string;
  family: FamilyId;
  label: string;
  blocked?: boolean;
}

const CATEGORIES: Category[] = [
  { id: "labels_roll", family: "labels", label: "Roll labels and stickers" },
  { id: "labels_sheet", family: "labels", label: "Sheet labels" },
  { id: "cartons_folding", family: "cartons", label: "Folding cartons" },
  { id: "cartons_mailer", family: "cartons", label: "Mailer boxes and sleeves" },
  { id: "hair_bundles", family: "hair", label: "Raw and virgin hair bundles" },
  { id: "hair_closures", family: "hair", label: "Closures and frontals" },
  { id: "other", family: "other", label: "Another category (request review)" },
  { id: "blocked_gloves", family: "other", label: "Medical gloves and devices", blocked: true },
  { id: "blocked_cosmetics", family: "other", label: "Finished cosmetics", blocked: true },
  {
    id: "blocked_ingestible",
    family: "other",
    label: "Supplements and ingestibles",
    blocked: true,
  },
];

interface AttributeDef {
  code: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  placeholder?: string;
  hard: boolean;
}

const ATTRIBUTES: Record<FamilyId, AttributeDef[]> = {
  labels: [
    {
      code: "material",
      label: "Face material",
      type: "select",
      hard: true,
      options: [
        "BOPP (white)",
        "BOPP (clear)",
        "Paper (semi-gloss)",
        "Paper (matte)",
        "PET",
        "Not sure",
      ],
    },
    { code: "size", label: "Size (W × H, mm)", type: "text", hard: true, placeholder: "50 × 76" },
    {
      code: "print",
      label: "Print",
      type: "select",
      hard: true,
      options: ["4-color (CMYK)", "1-color", "2-color", "CMYK + white", "Not sure"],
    },
    {
      code: "finish",
      label: "Finish",
      type: "select",
      hard: true,
      options: ["Matte lamination", "Gloss lamination", "Varnish", "None", "Not sure"],
    },
    {
      code: "adhesive",
      label: "Adhesive",
      type: "select",
      hard: true,
      options: ["Permanent", "Removable", "Freezer grade", "Not sure"],
    },
    {
      code: "core",
      label: "Core diameter",
      type: "select",
      hard: false,
      options: ["76 mm (3 in)", "25 mm (1 in)", "40 mm", "Not sure"],
    },
    {
      code: "labelsPerRoll",
      label: "Labels per roll",
      type: "text",
      hard: false,
      placeholder: "500",
    },
  ],
  cartons: [
    {
      code: "board",
      label: "Board",
      type: "select",
      hard: true,
      options: ["350 gsm C1S", "300 gsm C1S", "400 gsm C2S", "Kraft 300 gsm", "Not sure"],
    },
    {
      code: "size",
      label: "Size (L × W × H, mm)",
      type: "text",
      hard: true,
      placeholder: "120 × 60 × 40",
    },
    {
      code: "print",
      label: "Print",
      type: "select",
      hard: true,
      options: ["4-color (CMYK)", "1-color", "CMYK + spot", "Not sure"],
    },
    {
      code: "finish",
      label: "Finish",
      type: "select",
      hard: true,
      options: ["Matte lamination", "Gloss lamination", "Soft-touch", "Not sure"],
    },
    {
      code: "style",
      label: "Carton style",
      type: "select",
      hard: false,
      options: ["Tuck-end", "Crash-lock bottom", "Sleeve", "Not sure"],
    },
  ],
  hair: [
    {
      code: "origin",
      label: "Declared origin",
      type: "select",
      hard: true,
      options: ["Vietnamese", "Chinese", "Indian", "Not sure"],
    },
    {
      code: "texture",
      label: "Texture",
      type: "select",
      hard: true,
      options: ["Straight", "Body wave", "Deep wave", "Curly", "Not sure"],
    },
    {
      code: "lengthRange",
      label: "Length range (in)",
      type: "text",
      hard: true,
      placeholder: "18–22",
    },
    {
      code: "weight",
      label: "Weight per bundle (g)",
      type: "text",
      hard: true,
      placeholder: "100",
    },
    {
      code: "weft",
      label: "Weft type",
      type: "select",
      hard: false,
      options: ["Machine double weft", "Hand-tied", "Not sure"],
    },
  ],
  other: [],
};

const UNITS = ["pcs", "sets", "rolls", "bundles", "cartons", "kg"];
const INCOTERMS = [
  { value: "unknown", label: "Not sure — advise me" },
  { value: "EXW", label: "EXW — collected at the factory" },
  { value: "FCA", label: "FCA — handed to my carrier" },
  { value: "FOB", label: "FOB — loaded at a Chinese port" },
  { value: "CIF", label: "CIF — delivered to a U.S. port, insured" },
  { value: "DAP", label: "DAP — delivered to my address, duties unpaid" },
  { value: "DDP", label: "DDP — delivered to my address, duties paid" },
];
const COMPLIANCE = [
  {
    id: "prop65",
    label: "California Proposition 65",
    description: "Warning labelling for listed substances.",
  },
  { id: "fda_food", label: "FDA food-contact", description: "Materials touching food." },
  { id: "reach", label: "EU REACH / RoHS", description: "If you also ship to the EU." },
  {
    id: "unsure",
    label: "Not sure — flag for review",
    description: "An operator will raise compliance questions with you.",
  },
];
const INSPECTION = [
  { value: "none", label: "No inspection", description: "Rely on supplier photos and documents." },
  {
    value: "psi",
    label: "Pre-shipment inspection",
    description: "Sampled check against the confirmed spec before shipping.",
  },
  {
    value: "inline_psi",
    label: "In-line and pre-shipment",
    description: "Checkpoint during production plus a final inspection.",
  },
];

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
]);
const MAX_BYTES = 25 * 1024 * 1024;

/* ----------------------------------------------------------------------------------------------- */
/* State                                                                                              */
/* ----------------------------------------------------------------------------------------------- */

interface Variant {
  id: number;
  name: string;
  note: string;
}

interface Attachment {
  id: number;
  name: string;
  size: number;
  kind: "pdf" | "sheet" | "image" | "other";
}

interface Brief {
  categoryId: string;
  productName: string;
  descriptionEn: string;
  descriptionZh: string;
  variants: Variant[];
  quantity: string;
  unit: string;
  postalCode: string;
  cityState: string;
  leadTimeWeeks: string;
  incoterm: string;
  targetUnitPriceUsd: string;
  attributes: Record<string, string>;
  tolerance: string;
  compliance: Set<string>;
  sampleRequired: boolean;
  inspection: string;
  qualityNotes: string;
  attachments: Attachment[];
  links: string[];
}

const INITIAL: Brief = {
  categoryId: "",
  productName: "",
  descriptionEn: "",
  descriptionZh: "",
  variants: [{ id: 1, name: "", note: "" }],
  quantity: "",
  unit: "pcs",
  postalCode: "",
  cityState: "",
  leadTimeWeeks: "",
  incoterm: "unknown",
  targetUnitPriceUsd: "",
  attributes: {},
  tolerance: "",
  compliance: new Set(),
  sampleRequired: true,
  inspection: "psi",
  qualityNotes: "",
  attachments: [],
  links: [],
};

const STEPS: StepDef[] = [
  { id: "product", title: "Product", summary: "Category, description, variants" },
  { id: "quantity", title: "Quantity and destination", summary: "How many, where to, by when" },
  { id: "spec", title: "Specification and quality", summary: "Attributes, compliance, inspection" },
  { id: "documents", title: "Documents", summary: "Artwork, drawings, existing quotes" },
  { id: "review", title: "Review and submit", summary: "Missing fields, what happens next" },
];

type Errors = Partial<Record<string, string>>;

function validateStep(step: number, b: Brief): Errors {
  const e: Errors = {};
  const category = CATEGORIES.find((c) => c.id === b.categoryId);
  if (step === 0) {
    if (!b.categoryId) e.categoryId = "Choose a category.";
    if (category?.blocked)
      e.categoryId = "This category needs compliance review and cannot be quoted self-service.";
    if (b.productName.trim().length < 3) e.productName = "Give the product a short name.";
    if (b.descriptionEn.trim().length < 20)
      e.descriptionEn = "Describe the product in at least a sentence.";
  }
  if (step === 1) {
    const qty = Number(b.quantity.replace(/,/g, ""));
    if (!b.quantity || !Number.isFinite(qty) || qty <= 0)
      e.quantity = "Enter the quantity you want quoted.";
    if (!/^\d{5}(-\d{4})?$/.test(b.postalCode.trim()))
      e.postalCode = "Enter a 5-digit U.S. ZIP code.";
  }
  if (step === 2 && category && category.family !== "other") {
    for (const attr of ATTRIBUTES[category.family].filter((a) => a.hard)) {
      if (!b.attributes[attr.code])
        e[`attr_${attr.code}`] = "Required for matching. Choose “Not sure” if unknown.";
    }
  }
  return e;
}

/** AC-B1.1: the brief can always be saved as a draft; options cannot be requested until these are present. */
function requiredForSubmission(b: Brief): string[] {
  const missing: string[] = [];
  const category = CATEGORIES.find((c) => c.id === b.categoryId);
  if (!category || category.blocked) missing.push("Category");
  if (!b.productName.trim()) missing.push("Product name");
  if (!b.descriptionEn.trim()) missing.push("Description");
  if (!b.quantity || Number(b.quantity.replace(/,/g, "")) <= 0) missing.push("Quantity");
  if (!/^\d{5}(-\d{4})?$/.test(b.postalCode.trim())) missing.push("Destination ZIP code");
  if (category && category.family !== "other")
    for (const attr of ATTRIBUTES[category.family].filter((a) => a.hard))
      if (!b.attributes[attr.code]) missing.push(attr.label);
  return missing;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function kindOf(type: string): Attachment["kind"] {
  if (type === "application/pdf") return "pdf";
  if (type.includes("sheet") || type === "text/csv") return "sheet";
  if (type.startsWith("image/")) return "image";
  return "other";
}

/* ----------------------------------------------------------------------------------------------- */
/* Screen                                                                                             */
/* ----------------------------------------------------------------------------------------------- */

export function NewRequestWizard() {
  const [brief, setBrief] = useState<Brief>(INITIAL);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const category = CATEGORIES.find((c) => c.id === brief.categoryId);
  const family: FamilyId = category?.family ?? "other";
  const missing = useMemo(() => requiredForSubmission(brief), [brief]);

  // Autosave indicator (local only).
  useEffect(() => {
    if (!touched) return;
    const t = setTimeout(
      () =>
        setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })),
      600,
    );
    return () => clearTimeout(t);
  }, [brief, touched]);

  const update = <K extends keyof Brief>(key: K, value: Brief[K]) => {
    setTouched(true);
    setBrief((b) => ({ ...b, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const setAttribute = (code: string, value: string) => {
    setTouched(true);
    setBrief((b) => ({ ...b, attributes: { ...b.attributes, [code]: value } }));
    setErrors((e) => {
      const next = { ...e };
      delete next[`attr_${code}`];
      return next;
    });
  };

  const goTo = (index: number) => {
    setStep(index);
    setErrors({});
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    const e = validateStep(step, brief);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setCompleted((s) => new Set(s).add(step));
    goTo(Math.min(step + 1, STEPS.length - 1));
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: Attachment[] = [];
    const rejected: string[] = [];
    Array.from(list).forEach((f, i) => {
      if (!ALLOWED_TYPES.has(f.type)) rejected.push(`${f.name}: file type not accepted`);
      else if (f.size > MAX_BYTES) rejected.push(`${f.name}: larger than 25 MB`);
      else accepted.push({ id: Date.now() + i, name: f.name, size: f.size, kind: kindOf(f.type) });
    });
    setFileError(rejected.length ? rejected.join(" · ") : null);
    if (accepted.length) update("attachments", [...brief.attachments, ...accepted]);
  };

  if (submitted) {
    return (
      <AppShell workspace="buyer" title="New sourcing request">
        <div className="mx-auto max-w-2xl">
          <Panel>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ok/10 text-ok">
                <Icon name="check" size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">Request saved as brief v1</h2>
                <p className="mt-1 text-[14px] text-slate">
                  {brief.productName} · {brief.quantity} {brief.unit} to {brief.postalCode}. Your
                  raw input is stored as version 1. Next, a structured specification is proposed in
                  English and Chinese with every value marked <em>from input</em>, <em>inferred</em>{" "}
                  or <em>missing</em>; nothing inferred is used for matching until you confirm it.
                  An operator is assigned before any supplier is contacted.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/design-preview/buyer/dashboard"
                    className="inline-flex h-(--fbg-control-h) items-center rounded-(--fbg-radius-control) bg-(--fbg-action-primary) px-5 text-[15px] font-medium text-(--fbg-action-on-primary) hover:bg-(--fbg-action-primary-hover)"
                  >
                    Back to overview
                  </Link>
                  <Button
                    onClick={() => {
                      setBrief(INITIAL);
                      setStep(0);
                      setCompleted(new Set());
                      setSubmitted(false);
                      setTouched(false);
                      setSavedAt(null);
                    }}
                  >
                    Start another request
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell workspace="buyer" title="New sourcing request">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="New sourcing request"
          lead="Describe what you need in your own words. Required fields unlock supplier options; everything else helps us match more precisely."
          meta={
            <span className="flex items-center gap-1 text-xs text-slate">
              <Icon name={savedAt ? "check" : "clock"} size={12} />
              {savedAt
                ? `Draft saved locally at ${savedAt}`
                : "Draft saves automatically as you type"}
            </span>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <Stepper steps={STEPS} current={step} completed={completed} onSelect={goTo} />
          </div>

          <div className="min-w-0">
            {/* Step 1: Product */}
            {step === 0 && (
              <Panel
                title="Product"
                description="Pick the closest category, then describe the product as you would to a factory."
              >
                <div className="flex flex-col gap-5">
                  <fieldset>
                    <legend className="text-sm font-medium text-ink">
                      Category <span className="text-danger">*</span>
                    </legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {CATEGORIES.map((c) => {
                        const selected = brief.categoryId === c.id;
                        return (
                          <label
                            key={c.id}
                            className={cx(
                              "flex cursor-pointer items-start gap-3 rounded-(--fbg-radius-control) border p-3",
                              selected
                                ? "border-ink bg-surface"
                                : "border-line bg-surface hover:border-ink/30",
                              c.blocked && "cursor-not-allowed bg-paper",
                            )}
                          >
                            <input
                              type="radio"
                              name="category"
                              value={c.id}
                              checked={selected}
                              disabled={c.blocked}
                              onChange={() => update("categoryId", c.id)}
                              className="mt-0.5 accent-ink"
                            />
                            <span className="min-w-0">
                              <span
                                className={cx(
                                  "block text-sm",
                                  c.blocked ? "text-slate" : "text-ink",
                                )}
                              >
                                {c.label}
                              </span>
                              {c.blocked ? (
                                <span className="mt-1 inline-flex items-center gap-1 text-xs text-warn">
                                  <Icon name="flag" size={12} /> Compliance review required — not
                                  self-service
                                </span>
                              ) : c.family === "other" ? (
                                <span className="block text-xs text-slate">
                                  An operator reviews new categories first.
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {errors.categoryId ? (
                      <p className="mt-2 flex items-center gap-1 text-xs text-danger">
                        <Icon name="alert" size={12} /> {errors.categoryId}
                      </p>
                    ) : null}
                  </fieldset>

                  <Field
                    label="Product name"
                    htmlFor="productName"
                    required
                    error={errors.productName}
                  >
                    <TextInput
                      id="productName"
                      value={brief.productName}
                      onChange={(e) => update("productName", e.target.value)}
                      placeholder="Custom BOPP roll labels"
                      aria-invalid={Boolean(errors.productName)}
                    />
                  </Field>

                  <Field
                    label="Description (English)"
                    htmlFor="descriptionEn"
                    required
                    error={errors.descriptionEn}
                    hint="Material, size, print, finish, use. Paste from an existing spec if you have one."
                  >
                    <TextArea
                      id="descriptionEn"
                      value={brief.descriptionEn}
                      onChange={(e) => update("descriptionEn", e.target.value)}
                      placeholder="2″ × 3″ white BOPP roll labels, permanent adhesive, 4-color print, matte lamination, for 8 oz jars…"
                      aria-invalid={Boolean(errors.descriptionEn)}
                    />
                  </Field>

                  <Field
                    label="Description (中文)"
                    htmlFor="descriptionZh"
                    hint="If you already have Chinese wording from a supplier, add it here. We translate otherwise."
                  >
                    <TextArea
                      id="descriptionZh"
                      lang="zh-CN"
                      value={brief.descriptionZh}
                      onChange={(e) => update("descriptionZh", e.target.value)}
                      placeholder="白色BOPP卷筒不干胶标签，永久胶，四色印刷，哑膜……"
                      className="fbg-zh"
                    />
                  </Field>

                  <div>
                    <p className="text-sm font-medium text-ink">
                      Variants or SKUs <span className="text-slate">(optional)</span>
                    </p>
                    <p className="text-xs text-slate">
                      One line per size, colour or artwork version you want quoted together.
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {brief.variants.map((v, i) => (
                        <li
                          key={v.id}
                          className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1.5fr_auto]"
                        >
                          <TextInput
                            aria-label={`Variant ${i + 1} name`}
                            value={v.name}
                            placeholder={i === 0 ? "Lavender 8 oz" : "Variant name"}
                            onChange={(e) =>
                              update(
                                "variants",
                                brief.variants.map((x) =>
                                  x.id === v.id ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <TextInput
                            aria-label={`Variant ${i + 1} note`}
                            value={v.note}
                            placeholder="Artwork file, colour, difference from base"
                            className="col-span-2 sm:col-span-1"
                            onChange={(e) =>
                              update(
                                "variants",
                                brief.variants.map((x) =>
                                  x.id === v.id ? { ...x, note: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <Button
                            variant="ghost"
                            icon="x"
                            aria-label={`Remove variant ${i + 1}`}
                            className="col-start-2 row-start-1 sm:col-start-3"
                            disabled={brief.variants.length === 1}
                            onClick={() =>
                              update(
                                "variants",
                                brief.variants.filter((x) => x.id !== v.id),
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      icon="plus"
                      className="mt-2"
                      onClick={() =>
                        update("variants", [
                          ...brief.variants,
                          { id: Date.now(), name: "", note: "" },
                        ])
                      }
                    >
                      Add variant
                    </Button>
                  </div>
                </div>
              </Panel>
            )}

            {/* Step 2: Quantity and destination */}
            {step === 1 && (
              <Panel
                title="Quantity and destination"
                description="Quotes are tiered by quantity, and landed cost depends on where the goods go."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Quantity"
                    htmlFor="quantity"
                    required
                    error={errors.quantity}
                    hint="The quantity you want priced. Add alternative quantities in the notes."
                  >
                    <TextInput
                      id="quantity"
                      inputMode="numeric"
                      value={brief.quantity}
                      onChange={(e) => update("quantity", e.target.value)}
                      placeholder="10,000"
                      className="fbg-num"
                      aria-invalid={Boolean(errors.quantity)}
                    />
                  </Field>
                  <Field label="Unit" htmlFor="unit" required>
                    <Select
                      id="unit"
                      value={brief.unit}
                      onChange={(e) => update("unit", e.target.value)}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Destination ZIP code"
                    htmlFor="postalCode"
                    required
                    error={errors.postalCode}
                    hint="U.S. delivery address. Used for freight and duty estimates."
                  >
                    <TextInput
                      id="postalCode"
                      inputMode="numeric"
                      value={brief.postalCode}
                      onChange={(e) => update("postalCode", e.target.value)}
                      placeholder="07102"
                      className="fbg-num"
                      aria-invalid={Boolean(errors.postalCode)}
                    />
                  </Field>
                  <Field label="City and state" htmlFor="cityState">
                    <TextInput
                      id="cityState"
                      value={brief.cityState}
                      onChange={(e) => update("cityState", e.target.value)}
                      placeholder="Newark, NJ"
                    />
                  </Field>
                  <Field
                    label="Target lead time"
                    htmlFor="leadTimeWeeks"
                    hint="From order to goods at your door."
                  >
                    <Select
                      id="leadTimeWeeks"
                      value={brief.leadTimeWeeks}
                      onChange={(e) => update("leadTimeWeeks", e.target.value)}
                    >
                      <option value="">No target</option>
                      <option value="4">Within 4 weeks</option>
                      <option value="6">Within 6 weeks</option>
                      <option value="8">Within 8 weeks</option>
                      <option value="12">Within 12 weeks</option>
                    </Select>
                  </Field>
                  <Field
                    label="Target trade term"
                    htmlFor="incoterm"
                    hint="If unsure, leave it. Quotes are grouped by trade term and never ranked across terms on price alone."
                  >
                    <Select
                      id="incoterm"
                      value={brief.incoterm}
                      onChange={(e) => update("incoterm", e.target.value)}
                    >
                      {INCOTERMS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Target unit price (USD)"
                    htmlFor="targetUnitPriceUsd"
                    hint="Shared with operators only, never with suppliers."
                  >
                    <TextInput
                      id="targetUnitPriceUsd"
                      inputMode="decimal"
                      value={brief.targetUnitPriceUsd}
                      onChange={(e) => update("targetUnitPriceUsd", e.target.value)}
                      placeholder="0.03"
                      className="fbg-num"
                    />
                  </Field>
                </div>
              </Panel>
            )}

            {/* Step 3: Specification and quality */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <Panel
                  title="Specification"
                  description={
                    family === "other"
                      ? "Attribute fields appear once an operator maps your category."
                      : "Values marked required are used for exact matching. Choose “Not sure” rather than guessing; unknown is never assumed equal."
                  }
                >
                  {family === "other" ? (
                    <Notice tone="neutral">
                      Describe the specification in the quality notes below for now.
                    </Notice>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">
                      {ATTRIBUTES[family].map((attr) => (
                        <Field
                          key={attr.code}
                          label={attr.label}
                          htmlFor={`attr_${attr.code}`}
                          required={attr.hard}
                          error={errors[`attr_${attr.code}`]}
                        >
                          {attr.type === "select" ? (
                            <Select
                              id={`attr_${attr.code}`}
                              value={brief.attributes[attr.code] ?? ""}
                              onChange={(e) => setAttribute(attr.code, e.target.value)}
                              aria-invalid={Boolean(errors[`attr_${attr.code}`])}
                            >
                              <option value="">Select…</option>
                              {attr.options?.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <TextInput
                              id={`attr_${attr.code}`}
                              value={brief.attributes[attr.code] ?? ""}
                              placeholder={attr.placeholder}
                              onChange={(e) => setAttribute(attr.code, e.target.value)}
                              aria-invalid={Boolean(errors[`attr_${attr.code}`])}
                              className="fbg-num"
                            />
                          )}
                        </Field>
                      ))}
                      <Field
                        label="Tolerances and notes"
                        htmlFor="tolerance"
                        className="sm:col-span-2"
                        hint="Example: width ±0.5 mm; colour match to Pantone 2607 C; no visible registration shift."
                      >
                        <TextArea
                          id="tolerance"
                          value={brief.tolerance}
                          onChange={(e) => update("tolerance", e.target.value)}
                        />
                      </Field>
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Quality expectations"
                  description="What you expect checked before you pay or ship. Each check becomes a record with evidence, reviewer and date."
                >
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-sm font-medium text-ink">Compliance requirements</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {COMPLIANCE.map((c) => (
                          <Checkbox
                            key={c.id}
                            id={`comp_${c.id}`}
                            label={c.label}
                            description={c.description}
                            checked={brief.compliance.has(c.id)}
                            onChange={(on) => {
                              const next = new Set(brief.compliance);
                              if (on) next.add(c.id);
                              else next.delete(c.id);
                              update("compliance", next);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <Checkbox
                      id="sampleRequired"
                      label="Approve a sample before production"
                      description="Recommended for new suppliers and new artwork. Adds time; prevents a wrong batch."
                      checked={brief.sampleRequired}
                      onChange={(on) => update("sampleRequired", on)}
                    />
                    <fieldset>
                      <legend className="text-sm font-medium text-ink">Inspection</legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {INSPECTION.map((opt) => {
                          const selected = brief.inspection === opt.value;
                          return (
                            <label
                              key={opt.value}
                              className={cx(
                                "flex cursor-pointer items-start gap-3 rounded-(--fbg-radius-control) border p-3",
                                selected
                                  ? "border-teal/50 bg-teal/5"
                                  : "border-line bg-surface hover:border-ink/30",
                              )}
                            >
                              <input
                                type="radio"
                                name="inspection"
                                value={opt.value}
                                checked={selected}
                                onChange={() => update("inspection", opt.value)}
                                className="mt-0.5 accent-teal"
                              />
                              <span>
                                <span className="block text-sm font-medium text-ink">
                                  {opt.label}
                                </span>
                                <span className="block text-xs text-slate">{opt.description}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <Field
                      label="Quality notes"
                      htmlFor="qualityNotes"
                      hint="Defects you have seen before, packaging requirements, reference standards."
                    >
                      <TextArea
                        id="qualityNotes"
                        value={brief.qualityNotes}
                        onChange={(e) => update("qualityNotes", e.target.value)}
                      />
                    </Field>
                  </div>
                </Panel>
              </div>
            )}

            {/* Step 4: Documents */}
            {step === 3 && (
              <Panel
                title="Documents"
                description="Artwork, drawings, photos of a reference product, or quotes you already hold. Files are scanned before anyone opens them."
              >
                <div className="flex flex-col gap-4">
                  <Notice tone="warn" title="Prototype: files stay on your device">
                    This screen records only the file name and size. The real upload flow
                    (quarantine, malware scan, extraction) arrives with backlog items B-10 to B-13.
                  </Notice>
                  <label
                    htmlFor="files"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-(--fbg-radius-control) border border-dashed border-line bg-paper px-6 py-10 text-center hover:border-ink/40"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addFiles(e.dataTransfer.files);
                    }}
                  >
                    <Icon name="upload" size={22} className="text-slate" />
                    <span className="text-sm font-medium text-ink">
                      Drop files here or choose from your device
                    </span>
                    <span className="text-xs text-slate">
                      PDF, XLSX, CSV, PNG or JPG · up to 25 MB each
                    </span>
                    <input
                      id="files"
                      type="file"
                      multiple
                      accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg,image/*"
                      className="sr-only"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {fileError ? (
                    <Notice tone="danger" title="Some files were not added">
                      {fileError}
                    </Notice>
                  ) : null}
                  {brief.attachments.length > 0 ? (
                    <ul className="divide-y divide-line rounded-(--fbg-radius-control) border border-line">
                      {brief.attachments.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                          <Icon
                            name={a.kind === "image" ? "camera" : "document"}
                            size={16}
                            className="shrink-0 text-slate"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.name}</span>
                          <span className="fbg-num text-xs text-slate">{formatBytes(a.size)}</span>
                          <Badge tone="neutral" icon="clock">
                            Will be scanned
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="x"
                            aria-label={`Remove ${a.name}`}
                            onClick={() =>
                              update(
                                "attachments",
                                brief.attachments.filter((x) => x.id !== a.id),
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div>
                    <p className="text-sm font-medium text-ink">
                      Reference links <span className="text-slate">(optional)</span>
                    </p>
                    <p className="text-xs text-slate">
                      A product page or a listing you want matched. Links are references for
                      operators, never a source of prices.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <TextInput
                        aria-label="Reference link"
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        placeholder="https://"
                        inputMode="url"
                      />
                      <Button
                        icon="plus"
                        disabled={!/^https?:\/\/\S+$/.test(linkDraft)}
                        onClick={() => {
                          update("links", [...brief.links, linkDraft]);
                          setLinkDraft("");
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    {brief.links.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-1">
                        {brief.links.map((l) => (
                          <li key={l} className="flex items-center gap-2 text-sm">
                            <Icon name="external" size={14} className="text-slate" />
                            <span className="min-w-0 flex-1 truncate text-ink">{l}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="x"
                              aria-label={`Remove ${l}`}
                              onClick={() =>
                                update(
                                  "links",
                                  brief.links.filter((x) => x !== l),
                                )
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </Panel>
            )}

            {/* Step 5: Review */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                {missing.length > 0 ? (
                  <Notice
                    tone="warn"
                    title={`${missing.length} required ${missing.length === 1 ? "field is" : "fields are"} missing`}
                  >
                    {missing.join(", ")}. You can save this as a draft now; supplier options can be
                    requested once they are filled in.
                  </Notice>
                ) : (
                  <Notice tone="ok" title="Ready to submit">
                    All required fields are present. Your raw input is stored as version 1 before
                    anything is structured.
                  </Notice>
                )}

                <Panel
                  title="Summary"
                  actions={
                    <Button size="sm" onClick={() => goTo(0)}>
                      Edit
                    </Button>
                  }
                >
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ReviewItem label="Category" value={category?.label} />
                    <ReviewItem label="Product name" value={brief.productName} />
                    <ReviewItem label="Description" value={brief.descriptionEn} wide />
                    {brief.descriptionZh ? (
                      <ReviewItem label="描述" value={brief.descriptionZh} wide zh />
                    ) : null}
                    <ReviewItem
                      label="Variants"
                      value={
                        brief.variants
                          .filter((v) => v.name)
                          .map((v) => v.name)
                          .join(", ") || undefined
                      }
                    />
                    <ReviewItem
                      label="Quantity"
                      value={brief.quantity ? `${brief.quantity} ${brief.unit}` : undefined}
                      num
                    />
                    <ReviewItem
                      label="Destination"
                      value={
                        brief.postalCode
                          ? `${brief.postalCode}${brief.cityState ? ` · ${brief.cityState}` : ""}`
                          : undefined
                      }
                      num
                    />
                    <ReviewItem
                      label="Target lead time"
                      value={
                        brief.leadTimeWeeks ? `Within ${brief.leadTimeWeeks} weeks` : "No target"
                      }
                    />
                    <ReviewItem
                      label="Target trade term"
                      value={INCOTERMS.find((t) => t.value === brief.incoterm)?.label}
                    />
                    {family !== "other"
                      ? ATTRIBUTES[family].map((a) => (
                          <ReviewItem
                            key={a.code}
                            label={a.label}
                            value={brief.attributes[a.code]}
                            required={a.hard}
                          />
                        ))
                      : null}
                    <ReviewItem
                      label="Compliance"
                      value={
                        brief.compliance.size
                          ? COMPLIANCE.filter((c) => brief.compliance.has(c.id))
                              .map((c) => c.label)
                              .join(", ")
                          : "None specified"
                      }
                      wide
                    />
                    <ReviewItem
                      label="Sample approval"
                      value={brief.sampleRequired ? "Required before production" : "Not required"}
                    />
                    <ReviewItem
                      label="Inspection"
                      value={INSPECTION.find((i) => i.value === brief.inspection)?.label}
                    />
                    <ReviewItem
                      label="Documents"
                      value={
                        brief.attachments.length
                          ? `${brief.attachments.length} file${brief.attachments.length === 1 ? "" : "s"} (pending scan)`
                          : "None"
                      }
                    />
                    <ReviewItem
                      label="Reference links"
                      value={brief.links.length ? `${brief.links.length}` : "None"}
                    />
                  </dl>
                </Panel>

                <Panel title="What happens after you submit">
                  <ol className="flex flex-col gap-2 text-sm text-slate">
                    {[
                      "Your raw input is stored as brief version 1 with a timestamp.",
                      "A structured specification is proposed in English and Chinese. Each value is marked from input, inferred or missing. You confirm it; inferred values are not used for matching until then.",
                      "An operator is assigned. Suppliers are contacted only after you approve the outbound request.",
                      "Quotes arrive as documents, are extracted, and are reviewed against their source before they count as confirmed.",
                    ].map((t, i) => (
                      <li key={t} className="flex gap-3">
                        <span className="fbg-num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/5 text-[11px] font-semibold text-ink">
                          {i + 1}
                        </span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              </div>
            )}

            {/* Action bar */}
            <div className="sticky bottom-16 z-20 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-(--fbg-radius-card) border border-line bg-(--fbg-bg-surface)/95 p-3 backdrop-blur md:bottom-4">
              <Button
                variant="ghost"
                icon="chevron-left"
                disabled={step === 0}
                onClick={() => goTo(step - 1)}
              >
                Back
              </Button>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <Button
                  onClick={() =>
                    setSavedAt(
                      new Date().toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    )
                  }
                >
                  Save draft
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button variant="primary" iconRight="chevron-right" onClick={next}>
                    Continue
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={missing.length > 0}
                    title={missing.length > 0 ? `Missing: ${missing.join(", ")}` : undefined}
                    onClick={() => setSubmitted(true)}
                  >
                    Submit request
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ReviewItem({
  label,
  value,
  required,
  wide,
  num,
  zh,
}: {
  label: string;
  value: string | undefined;
  required?: boolean;
  wide?: boolean;
  num?: boolean;
  zh?: boolean;
}) {
  const present = value !== undefined && value !== "";
  return (
    <div className={cx("min-w-0", wide && "sm:col-span-2")}>
      <dt className="flex items-center gap-2 text-xs text-slate">
        {label}
        {present ? (
          <Badge tone="neutral" icon={null}>
            from input
          </Badge>
        ) : (
          <Badge tone={required ? "danger" : "neutral"} icon={required ? "alert" : null}>
            missing
          </Badge>
        )}
      </dt>
      <dd
        className={cx(
          "mt-0.5 text-sm",
          present ? "text-ink" : "text-slate",
          num && "fbg-num",
          zh && "fbg-zh",
        )}
        lang={zh ? "zh-CN" : undefined}
      >
        {present ? value : "—"}
      </dd>
    </div>
  );
}
