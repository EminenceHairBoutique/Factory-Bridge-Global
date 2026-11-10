import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { loadWorld, type UserKey, type World } from "./world";

let cached: World | null = null;
/** Loaded lazily: Playwright collects spec files before global setup has written world.json. */
export function world(): World {
  cached ??= loadWorld();
  return cached;
}

/** Sign in through the real form (password). Leaves the page wherever the app sends the user. */
export async function signIn(page: Page, user: UserKey, next?: string): Promise<void> {
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(world().users[user].email);
  await page.getByLabel("Password", { exact: true }).fill(world().password);
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
export async function latestEmailCode(email: string, sentAfter: Date): Promise<string> {
  const { mailpitUrl } = e2eEnv();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=5`,
    );
    if (search.ok) {
      const body = (await search.json()) as { messages?: Array<{ ID: string; Created: string }> };
      const fresh = (body.messages ?? []).find((m) => new Date(m.Created) >= sentAfter);
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
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`e2e: no sign-in code arrived for ${email}`);
}
