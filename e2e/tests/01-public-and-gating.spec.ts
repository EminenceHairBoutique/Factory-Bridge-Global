import { expect, test } from "@playwright/test";
import { field, world } from "../support/helpers";

test.describe("public site and signed-out gating", () => {
  test("the public home links to the real sign-in page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#hero-heading")).toContainText("Know your true cost");
    await page.getByRole("link", { name: "Sign in" }).first().click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
    await expect(field(page, "Email")).toBeVisible();
    await expect(page.getByLabel("Email for a sign-in code")).toBeVisible();
  });

  test("signed out, every workspace URL redirects to sign-in and keeps only an allowed next", async ({
    page,
  }) => {
    const { projects } = world();
    for (const path of [
      "/app",
      "/ops",
      "/supplier",
      `/app/projects/${projects.a}`,
      `/ops/projects/${projects.a}`,
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(`/sign-in?next=${encodeURIComponent(path)}`);
    }
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fonboarding$/);
    // an off-site next is dropped, not followed
    await page.goto("/sign-in?next=https%3A%2F%2Fevil.example%2F");
    await expect(page.locator('input[name="next"]')).toHaveCount(0);
  });

  test("a wrong password is refused without saying whether the account exists", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await field(page, "Email").fill(world().users.buyerAOwner.email);
    await field(page, "Password").fill(`wrong-${world().runId}-input`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
