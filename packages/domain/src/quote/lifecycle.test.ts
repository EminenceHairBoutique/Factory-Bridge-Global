import { describe, expect, it } from "vitest";
import { QUOTE_STATUSES } from "../enums.js";
import { canTransition, isEligibleForComparison, isTerminal } from "./lifecycle.js";

describe("quotation lifecycle (ADR-021)", () => {
  it("enum holds only confirmed-quotation states", () => {
    expect([...QUOTE_STATUSES]).toEqual(["confirmed", "superseded", "expired", "withdrawn"]);
  });

  it("confirmed → superseded is allowed only via supersede for reviewers/operators", () => {
    expect(canTransition("confirmed", "superseded", "reviewer")).toEqual({
      allowed: true,
      viaSupersedeOnly: true,
    });
    expect(canTransition("confirmed", "superseded", "supplier_owner")).toEqual({
      allowed: false,
      reason: "actor_not_permitted",
    });
  });

  it("system may expire but may not withdraw", () => {
    expect(canTransition("confirmed", "expired", "system").allowed).toBe(true);
    expect(canTransition("confirmed", "withdrawn", "system")).toEqual({
      allowed: false,
      reason: "actor_not_permitted",
    });
  });

  it("supplier owner may withdraw its own quote", () => {
    expect(canTransition("confirmed", "withdrawn", "supplier_owner").allowed).toBe(true);
  });

  it("expired can only be superseded (revalidation = new version); never restored to confirmed", () => {
    expect(canTransition("expired", "superseded", "assigned_operator").allowed).toBe(true);
    expect(canTransition("expired", "confirmed", "platform_admin")).toEqual({
      allowed: false,
      reason: "invalid_transition",
    });
  });

  it("superseded and withdrawn are terminal for every actor", () => {
    for (const from of ["superseded", "withdrawn"] as const) {
      expect(isTerminal(from)).toBe(true);
      for (const to of QUOTE_STATUSES) {
        expect(canTransition(from, to, "platform_admin")).toEqual({
          allowed: false,
          reason: "terminal_state",
        });
      }
    }
  });

  it("only a current confirmed quotation is eligible for comparison", () => {
    expect(isEligibleForComparison("confirmed", true)).toBe(true);
    expect(isEligibleForComparison("confirmed", false)).toBe(false);
    expect(isEligibleForComparison("expired", true)).toBe(false);
  });
});
