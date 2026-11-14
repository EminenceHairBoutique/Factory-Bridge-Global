/**
 * RFC 6238 TOTP for the e2e suite (B-05b): SHA-1, 6 digits, 30-second steps, which is what Supabase Auth issues.
 * The tests compute codes from the setup key Supabase returned at enrolment, exactly as an authenticator app would.
 *
 * Each code is used at most once per secret: freshTotp() remembers the last step it handed out for a secret and waits
 * for the next step rather than repeat it, so the suite does not depend on whether Supabase Auth refuses a replayed
 * code. It also never hands out a code in the last two seconds of its step.
 */
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const PERIOD_SECONDS = 30;

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const index = ALPHABET.indexOf(ch);
    if (index < 0) throw new Error("e2e: the TOTP setup key is not base32");
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / PERIOD_SECONDS);
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary =
    ((mac[offset]! & 0x7f) << 24) |
    (mac[offset + 1]! << 16) |
    (mac[offset + 2]! << 8) |
    mac[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, "0");
}

const lastStep = new Map<string, number>();

/** Seed the memory of steps already used (e.g. by global setup, which runs in another process). */
export function rememberStep(secret: string, step: number): void {
  lastStep.set(secret, Math.max(step, lastStep.get(secret) ?? -1));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A code for the current step, never one already handed out for this secret, never in a step's last 2 s. */
export async function freshTotpWithStep(secret: string): Promise<{ code: string; step: number }> {
  for (;;) {
    const now = Date.now();
    const step = totpStep(now);
    const msLeft = (step + 1) * PERIOD_SECONDS * 1000 - now;
    if (step > (lastStep.get(secret) ?? -1) && msLeft > 2_000) {
      lastStep.set(secret, step);
      return { code: totpAt(secret, step), step };
    }
    await sleep(msLeft + 250);
  }
}

export async function freshTotp(secret: string): Promise<string> {
  return (await freshTotpWithStep(secret)).code;
}
