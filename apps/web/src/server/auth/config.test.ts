import { describe, expect, it } from "vitest";
import { INVITABLE_ROLES } from "@fbg/domain/workspace";
import { resolveSupabaseConfig } from "./config";
import { GRANTABLE_ROLES, PASSWORD_MIN, signUpSchema } from "./schemas";

const KEY = "eyJhbGciOiJIUzI1NiJ9.synthetic-local-anon-key.signature";

describe("resolveSupabaseConfig — fails closed", () => {
  it("is null when unset, empty, a placeholder or malformed", () => {
    expect(resolveSupabaseConfig({})).toBeNull();
    expect(
      resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY }),
    ).toBeNull();
    expect(
      resolveSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY,
      }),
    ).toBeNull();
    expect(
      resolveSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "replace-me",
      }),
    ).toBeNull();
    for (const url of [
      "ftp://x.example",
      "not a url",
      "https://user:pw@x.example",
      "https://x.example/?a=1",
    ]) {
      expect(
        resolveSupabaseConfig({
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY,
        }),
        url,
      ).toBeNull();
    }
  });

  it("accepts a real-looking local config; Secure cookies unless the app URL is plain http", () => {
    const local = resolveSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321/",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY,
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    });
    expect(local).toEqual({ url: "http://127.0.0.1:54321", anonKey: KEY, secureCookies: false });
    const hosted = resolveSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY,
    });
    expect(hosted?.secureCookies).toBe(true);
  });
});

describe("auth form schemas", () => {
  it("grantable roles equal the domain's invitable roles (and app.create_invite's list)", () => {
    expect([...GRANTABLE_ROLES]).toEqual([...INVITABLE_ROLES]);
  });

  it("sign-up enforces the password minimum on the server and normalises the email", () => {
    const short = signUpSchema.safeParse({
      email: "a@b.co",
      password: "x".repeat(PASSWORD_MIN - 1),
    });
    expect(short.success).toBe(false);
    const ok = signUpSchema.safeParse({
      email: "  Person@Example.COM ",
      password: "x".repeat(PASSWORD_MIN),
    });
    expect(ok.success && ok.data.email).toBe("person@example.com");
    expect(ok.success && ok.data.fullName).toBeNull();
  });
});
