import { describe, expect, it } from "vitest";
import { isInviteToken, isUuid, safeNextPath, signInHref } from "./paths";

describe("safeNextPath — post-sign-in redirect allow-list (no open redirect)", () => {
  it("keeps same-origin workspace, onboarding and invite paths (with their query)", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("/app/projects/123?tab=brief")).toBe("/app/projects/123?tab=brief");
    expect(safeNextPath("/ops")).toBe("/ops");
    expect(safeNextPath("/supplier")).toBe("/supplier");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
    expect(safeNextPath(`/invite/${"a".repeat(64)}`)).toBe(`/invite/${"a".repeat(64)}`);
  });

  it("drops absolute, protocol-relative, backslash and scheme tricks", () => {
    for (const bad of [
      "https://evil.example/app",
      "//evil.example/app",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "/app\n/evil",
      "/app\u0000",
      " //evil.example",
      "http:/evil.example",
    ]) {
      expect(safeNextPath(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("drops paths outside the allow-list, look-alike prefixes and traversal", () => {
    for (const bad of [
      "/",
      "/design-preview",
      "/api/health",
      "/application",
      "/apps",
      "/opsx",
      "/invite/",
      "/sign-in",
      "/app/../design-preview",
      "/%2e%2e/design-preview",
    ]) {
      expect(safeNextPath(bad), bad).toBeNull();
    }
  });

  it("drops non-strings and oversized input", () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(["/app"])).toBeNull();
    expect(safeNextPath(`/app/${"x".repeat(600)}`)).toBeNull();
  });

  it("signInHref carries only an allowed next", () => {
    expect(signInHref("/app/projects/1")).toBe("/sign-in?next=%2Fapp%2Fprojects%2F1");
    expect(signInHref("https://evil.example")).toBe("/sign-in");
    expect(signInHref(undefined)).toBe("/sign-in");
  });
});

describe("id validators", () => {
  it("isUuid", () => {
    expect(isUuid("e1aaaaaa-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("e1aaaaaa-0000-4000-8000-000000000001' or 1=1")).toBe(false);
  });

  it("isInviteToken matches app.create_invite's 64 lowercase hex characters only", () => {
    expect(isInviteToken("0123456789abcdef".repeat(4))).toBe(true);
    expect(isInviteToken("0123456789ABCDEF".repeat(4))).toBe(false);
    expect(isInviteToken("abc")).toBe(false);
    expect(isInviteToken(`${"a".repeat(64)}/x`)).toBe(false);
  });
});
