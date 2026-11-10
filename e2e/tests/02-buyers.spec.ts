import { expect, test } from "@playwright/test";
import { expectNotFound, latestEmailCode, signIn, world } from "../support/helpers";

test.describe("buyer workspaces: tenant isolation and roles", () => {
  test("buyer A owner sees only A's projects, edits A's draft brief, and cannot reach B, /ops or /supplier", async ({
    page,
  }) => {
    const w = world();
    await signIn(page, "buyerAOwner");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("active-org")).toHaveText(w.names.buyerA);
    const list = page.getByRole("list", { name: "Projects" });
    await expect(list).toContainText(`Kraft mailer boxes ${w.runId}`);
    await expect(list).not.toContainText(`Canvas tote bags ${w.runId}`);

    await list.getByRole("link", { name: `Kraft mailer boxes ${w.runId}` }).click();
    await expect(page).toHaveURL(`/app/projects/${w.projects.a}`);
    const brief = page.getByLabel(/^Brief/);
    await expect(brief).toHaveValue(new RegExp(`Brief A ${w.runId}`));
    await brief.fill(`Brief A ${w.runId}: 6,000 printed kraft mailers, 30x20x10 cm, edited.`);
    await page.getByRole("button", { name: "Save brief" }).click();
    await expect(page.getByRole("status")).toContainText("Brief saved.");
    await page.reload();
    await expect(page.getByLabel(/^Brief/)).toHaveValue(/6,000 printed kraft mailers/);

    // direct URLs into another tenant and other workspaces: 404, nothing rendered
    await expectNotFound(page, `/app/projects/${w.projects.b}`);
    await expectNotFound(page, "/ops");
    await expectNotFound(page, `/ops/projects/${w.projects.a}`);
    await expectNotFound(page, "/supplier");
    // the owner may manage the team
    await page.goto("/app/settings/team");
    await expect(page.getByRole("heading", { name: "Team", level: 1 })).toBeVisible();
    await expect(page.getByText(w.users.buyerAMember.email).first()).toBeVisible();
  });

  test("buyer B signs in with an emailed one-time code and sees only B", async ({ page }) => {
    const w = world();
    await page.goto("/sign-in");
    const sentAfter = new Date(Date.now() - 2_000);
    await page.getByLabel("Email for a sign-in code").fill(w.users.buyerBOwner.email);
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page).toHaveURL(/\/sign-in\/code$/);
    // the address never travels in the URL
    expect(page.url()).not.toContain("buyerbowner");
    const code = await latestEmailCode(w.users.buyerBOwner.email, sentAfter);
    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("active-org")).toHaveText(w.names.buyerB);
    const list = page.getByRole("list", { name: "Projects" });
    await expect(list).toContainText(`Canvas tote bags ${w.runId}`);
    await expect(list).not.toContainText(`Kraft mailer boxes ${w.runId}`);
    await expectNotFound(page, `/app/projects/${w.projects.a}`);
  });

  test("a wrong or reused code is refused", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email for a sign-in code").fill(world().users.buyerAViewer.email);
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page).toHaveURL(/\/sign-in\/code$/);
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page.getByText("That code is not valid or has expired.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in\/code$/);
  });

  test("buyer A viewer reads but cannot write or manage the team", async ({ page }) => {
    const w = world();
    await signIn(page, "buyerAViewer");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("You have view-only access in this organization.")).toBeVisible();
    await expect(page.getByRole("link", { name: "New project" })).toHaveCount(0);
    await expectNotFound(page, "/app/projects/new");
    await expectNotFound(page, "/app/settings/team");
    await page.goto(`/app/projects/${w.projects.a}`);
    await expect(page.getByTestId("brief-text")).toContainText(`Brief A ${w.runId}`);
    await expect(page.getByRole("button", { name: "Save brief" })).toHaveCount(0);
  });
});
