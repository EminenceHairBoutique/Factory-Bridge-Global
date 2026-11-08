import { describe, expect, it } from "vitest";
import {
  validateEmailAddress,
  validateInvites,
  validateOtp,
  validatePassword,
  validateZip,
} from "./auth-demo";

describe("auth prototype validators", () => {
  it("accepts a six-digit code with spaces and rejects anything else", () => {
    expect(validateOtp("123 456")).toBeNull();
    expect(validateOtp("12345")).not.toBeNull();
    expect(validateOtp("abcdef")).not.toBeNull();
  });
  it("uses a length-first password policy", () => {
    expect(validatePassword("correct horse battery")).toBeNull();
    expect(validatePassword("short1!")).toMatch(/12 characters/);
    expect(validatePassword("aaaaaaaaaaaa")).toMatch(/repetitive/);
  });
  it("blocks duplicate and invalid invites and the owner's own address", () => {
    const errors = validateInvites(
      [
        { id: 1, email: "a@example.com", role: "member" },
        { id: 2, email: "A@example.com", role: "viewer" },
        { id: 3, email: "owner@example.com", role: "admin" },
        { id: 4, email: "not-an-email", role: "member" },
        { id: 5, email: "", role: "member" },
      ],
      "owner@example.com",
    );
    expect(Object.keys(errors).map(Number).sort()).toEqual([2, 3, 4]);
    expect(errors[3]).toMatch(/own address/);
  });
  it("validates email and ZIP formats", () => {
    expect(validateEmailAddress("buyer@demo.example")).toBeNull();
    expect(validateZip("07102")).toBeNull();
    expect(validateZip("7102")).not.toBeNull();
  });
});
