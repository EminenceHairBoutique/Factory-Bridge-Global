import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { freshTotp, rememberStep } from "./totp";
import { ENROLLED_STAFF, loadWorld, type EnrolledStaff, type UserKey, type World } from "./world";

let cached: World | null = null;
/** Loaded lazily: Playwright collects spec files before global setup has written world.json. */
export function world(): World {
  if (!cached) {
    cached = loadWorld();
    // Global setup ran in another process; never reuse the step whose code it already spent.
    for (const key of ENROLLED_STAFF)
      rememberStep(cached.totp[key].secret, cached.totp[key].lastStep);
  }
  return cached;
}

/** A not-yet-used code for an enrolled staff member's authenticator (support/totp.ts). */
export function staffCode(user: EnrolledStaff): Promise<string> {
  return freshTotp(world().totp[user].secret);
}

/** Enter a TOTP code on the challenge or enrolment page and submit it. */
export async function submitTotp(page: Page, code: string, button: string): Promise<void> {
  await field(page, "6-digit code").fill(code);
  await page.getByRole("button", { name: button, exact: true }).click();
}

/**
 * Internal staff sign-in (B-05b): password, then the TOTP challenge the app requires before /ops (ADR-043).
 * Leaves the page wherever the app sends the user after the challenge.
 */
export async function signInStaff(page: Page, user: EnrolledStaff, next?: string): Promise<void> {
  await signIn(page, user, next);
  await expect(page).toHaveURL(/\/ops\/mfa\/verify(\?|$)/);
  await submitTotp(page, await staffCode(user), "Continue");
  await expect(page).not.toHaveURL(/\/ops\/mfa\//);
}

/** Sign in through the real form (password). Leaves the page wherever the app sends the user. */
export async function signIn(page: Page, user: UserKey, next?: string): Promise<void> {
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  await field(page, "Email").fill(world().users[user].email);
  await field(page, "Password").fill(world().password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in(\?|$)/);
}

/** A fresh browser context (own cookie jar) signed in as `user`. */
export async function contextFor(
  browser: Browser,
  user: UserKey,
  next?: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user, next);
  return { context, page };
}

/** Direct navigation must answer 404 with the site's not-found page — no data, no hint of what exists. */
export async function expectNotFound(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
}

/** The latest 6-digit code Supabase Auth sent to `email`, read from the local stack's Mailpit inbox. */
interface MailpitSummary {
  ID: string;
  Created: string;
  Subject?: string;
  To?: Array<{ Address?: string }>;
}

export async function latestEmailCode(email: string, sentAfter: Date): Promise<string> {
  const { mailpitUrl } = e2eEnv();
  const deadline = Date.now() + 30_000;
  let seen: MailpitSummary[] = [];
  while (Date.now() < deadline) {
    // List and filter here rather than relying on Mailpit's search syntax (a "+" in the address).
    const list = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`).catch(() => null);
    if (list?.ok) {
      const body = (await list.json()) as { messages?: MailpitSummary[] };
      seen = body.messages ?? [];
      const fresh = seen
        .filter((m) => (m.To ?? []).some((t) => t.Address?.toLowerCase() === email.toLowerCase()))
        .filter((m) => new Date(m.Created).getTime() >= sentAfter.getTime() - 5_000)
        .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime())[0];
      if (fresh) {
        const message = (await (
          await fetch(`${mailpitUrl}/api/v1/message/${fresh.ID}`)
        ).json()) as {
          Text?: string;
          HTML?: string;
        };
        const text = `${message.Text ?? ""} ${message.HTML ?? ""}`;
        // Prefer the digits right after "code" (GoTrue's template: "enter the code: 123456") over any 6-digit run.
        const code = (/code\b[^0-9]{0,40}(\d{6})\b/i.exec(text) ?? /\b(\d{6})\b/.exec(text))?.[1];
        if (code) return code;
        throw new Error(
          `e2e: the email to ${email} has no 6-digit code (template without {{ .Token }}?): ${text.slice(0, 400)}`,
        );
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const inbox = seen.map(
    (m) => `${m.Subject ?? "?"} → ${(m.To ?? []).map((t) => t.Address).join(",")}`,
  );
  throw new Error(
    `e2e: no sign-in code arrived for ${email}; Mailpit holds ${seen.length} message(s): ${inbox.join(" | ")}`,
  );
}

/** A form control by its visible label, ignoring the required-field marker ("Email *"). */
export function field(page: Page, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByLabel(new RegExp(`^${escaped}\\s*\\*?$`));
}
