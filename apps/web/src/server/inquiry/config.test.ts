import { describe, expect, it } from "vitest";
import { inquiryMode, resolveInquiryConfig } from "./config";

const resendEnv = {
  INQUIRY_DELIVERY: "resend",
  RESEND_API_KEY: "test-key-not-a-secret",
  EMAIL_FROM: "Factory Bridge Global <requests@mail.fbg-test.dev>",
  INQUIRY_TO_EMAIL: "inbox@fbg-test.dev",
};

describe("inquiry delivery configuration fails closed (proposed ADR-040)", () => {
  it("is not_configured by default in every environment", () => {
    expect(inquiryMode({})).toBe("not_configured");
    expect(inquiryMode({ NODE_ENV: "production", APP_ENV: "production" })).toBe("not_configured");
    expect(inquiryMode({ INQUIRY_DELIVERY: "disabled" })).toBe("not_configured");
    expect(inquiryMode({ INQUIRY_DELIVERY: "smtp" })).toBe("not_configured");
  });

  it("allows dry_run only outside a production deployment", () => {
    expect(inquiryMode({ NODE_ENV: "development", INQUIRY_DELIVERY: "dry_run" })).toBe("dry_run");
    expect(inquiryMode({ NODE_ENV: "test", INQUIRY_DELIVERY: "DRY_RUN" })).toBe("dry_run");
    expect(
      inquiryMode({ NODE_ENV: "production", APP_ENV: "staging", INQUIRY_DELIVERY: "dry_run" }),
    ).toBe("dry_run");
    for (const APP_ENV of [undefined, "", "production", "PROD"]) {
      expect(
        resolveInquiryConfig({ NODE_ENV: "production", APP_ENV, INQUIRY_DELIVERY: "dry_run" }),
      ).toEqual({ mode: "not_configured", reason: "dry_run_blocked_in_production" });
    }
  });

  it("requires every Resend value, and treats .env.example placeholders as missing", () => {
    expect(inquiryMode(resendEnv)).toBe("resend");
    expect(inquiryMode({ ...resendEnv, RESEND_API_KEY: "" })).toBe("not_configured");
    expect(inquiryMode({ ...resendEnv, RESEND_API_KEY: "replace-me" })).toBe("not_configured");
    expect(inquiryMode({ ...resendEnv, EMAIL_FROM: "noreply@your-verified-domain.example" })).toBe(
      "not_configured",
    );
    expect(inquiryMode({ ...resendEnv, INQUIRY_TO_EMAIL: undefined })).toBe("not_configured");
    expect(inquiryMode({ ...resendEnv, INQUIRY_TO_EMAIL: "someone@example.com" })).toBe(
      "not_configured",
    );
  });

  it("rejects malformed or multi-line addresses", () => {
    expect(inquiryMode({ ...resendEnv, INQUIRY_TO_EMAIL: "not an address" })).toBe(
      "not_configured",
    );
    expect(
      inquiryMode({ ...resendEnv, INQUIRY_TO_EMAIL: "inbox@fbg-test.dev\nbcc@evil.test" }),
    ).toBe("not_configured");
  });

  it("exposes only the mode to the page, never the key or addresses", () => {
    const mode = inquiryMode(resendEnv);
    expect(JSON.stringify(mode)).not.toContain("test-key-not-a-secret");
    expect(JSON.stringify(mode)).not.toContain("inbox@");
  });
});
