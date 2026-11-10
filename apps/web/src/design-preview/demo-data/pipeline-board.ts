/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. The record facts behind each project's stage on the
 * operations pipeline board (IA §2.4 `/ops`). Migration 0008 stores a project `status`
 * (draft / active / on_hold / closed), `lead_operator_id` and `compliance_hold`; the finer stage
 * shown here is derived from records (brief confirmation, shortlist, approved RFQs, quotations,
 * reviews, samples, approvals), so these facts stand in for those records.
 */
import type { PipelineStage } from "./ops-queue";

export const OPERATORS = ["Operator (demo)", "Operator 2 (demo)"] as const;
export type OperatorName = (typeof OPERATORS)[number];

export interface StageEntry {
  stage: PipelineStage;
  at: string;
  by: string;
}

export interface ProjectFacts {
  family: "Labels" | "Folding cartons" | "Hair bundles" | "Other";
  briefVersion: number;
  briefComplete: boolean;
  briefMissing: string | null;
  buyerConfirmedBrief: boolean;
  complianceHoldId: string | null;
  shortlisted: number;
  rfqsApprovedSent: number;
  quotesReceived: number;
  quotesConfirmed: number;
  buyerShortlisted: boolean;
  sampleRequestApprovedSent: boolean;
  sampleEvaluated: boolean;
  goldenSigned: boolean;
  selectionApproved: boolean;
  projectHref: string | null;
  history: StageEntry[];
}

const BASE: Omit<ProjectFacts, "family" | "history" | "projectHref"> = {
  briefVersion: 1,
  briefComplete: true,
  briefMissing: null,
  buyerConfirmedBrief: true,
  complianceHoldId: null,
  shortlisted: 0,
  rfqsApprovedSent: 0,
  quotesReceived: 0,
  quotesConfirmed: 0,
  buyerShortlisted: false,
  sampleRequestApprovedSent: false,
  sampleEvaluated: false,
  goldenSigned: false,
  selectionApproved: false,
};

export const PROJECT_FACTS: Record<string, ProjectFacts> = {
  prj_demo_labels: {
    ...BASE,
    family: "Labels",
    briefVersion: 3,
    shortlisted: 4,
    rfqsApprovedSent: 3,
    quotesReceived: 6,
    quotesConfirmed: 3,
    projectHref: "/design-preview/buyer/project",
    history: [
      { stage: "brief_draft", at: "2026-10-01", by: "Demo Buyer" },
      { stage: "brief_confirmed", at: "2026-10-03", by: "Demo Buyer" },
      { stage: "options_in_progress", at: "2026-10-04", by: "Operator (demo)" },
      { stage: "quotes_in_review", at: "2026-10-20", by: "Operator (demo)" },
      { stage: "comparison_ready", at: "2026-11-06", by: "Operator (demo)" },
    ],
  },
  prj_demo_cartons: {
    ...BASE,
    family: "Folding cartons",
    shortlisted: 3,
    rfqsApprovedSent: 2,
    quotesReceived: 2,
    quotesConfirmed: 1,
    projectHref: null,
    history: [
      { stage: "brief_confirmed", at: "2026-10-22", by: "Demo Buyer" },
      { stage: "options_in_progress", at: "2026-10-23", by: "Operator (demo)" },
      { stage: "quotes_in_review", at: "2026-11-05", by: "Operator (demo)" },
    ],
  },
  prj_demo_hair: {
    ...BASE,
    family: "Hair bundles",
    shortlisted: 2,
    projectHref: null,
    history: [
      { stage: "brief_draft", at: "2026-10-30", by: "Second Demo Buyer" },
      { stage: "brief_confirmed", at: "2026-11-03", by: "Second Demo Buyer" },
    ],
  },
  prj_demo_sleeves: {
    ...BASE,
    family: "Other",
    briefComplete: false,
    briefMissing: "print colors and sleeve dimensions",
    buyerConfirmedBrief: false,
    projectHref: null,
    history: [{ stage: "brief_draft", at: "2026-11-01", by: "Demo Buyer" }],
  },
  prj_demo_gloves: {
    ...BASE,
    family: "Other",
    buyerConfirmedBrief: false,
    complianceHoldId: "h_gloves",
    projectHref: null,
    history: [{ stage: "brief_draft", at: "2026-11-07", by: "Second Demo Buyer" }],
  },
  prj_demo_tea: {
    ...BASE,
    family: "Labels",
    shortlisted: 3,
    rfqsApprovedSent: 2,
    projectHref: null,
    history: [
      { stage: "brief_confirmed", at: "2026-10-28", by: "Second Demo Buyer" },
      { stage: "options_in_progress", at: "2026-10-30", by: "Operator 2 (demo)" },
    ],
  },
  prj_demo_mailers: {
    ...BASE,
    family: "Folding cartons",
    shortlisted: 2,
    rfqsApprovedSent: 2,
    quotesReceived: 2,
    quotesConfirmed: 2,
    buyerShortlisted: true,
    sampleRequestApprovedSent: true,
    sampleEvaluated: true,
    projectHref: null,
    history: [
      { stage: "comparison_ready", at: "2026-10-18", by: "Operator (demo)" },
      { stage: "sample_requested", at: "2026-10-25", by: "Demo Buyer" },
    ],
  },
};
