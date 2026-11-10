import { expect, test } from "@playwright/test";
import { world } from "../support/helpers";

test.describe("sign-up, organization creation, a brief, and the org switcher", () => {
  test("a newcomer signs up, creates a buyer org, creates and edits a brief, adds a supplier org and switches", async ({
    page,
  }) => {
    const w = world();
    const buyerName = `Cedar Kitchenware ${w.runId}`;
    const supplierName = `Ningbo Example Ceramics ${w.runId}`;

    await page.goto("/sign-up");
    await page.getByLabel(/^Full name/).fill("New Comer");
    await page.getByLabel("Work email").fill(w.users.newcomer.email);
    await page.getByLabel("Password", { exact: true }).fill(w.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    // no membership yet: every workspace sends them back to onboarding
    await page.goto("/app");
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByLabel("Organization type").selectOption("buyer");
    await page.getByLabel("Legal name").fill(`${buyerName} LLC`);
    await page.getByLabel("Display name", { exact: true }).fill(buyerName);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("active-org")).toHaveText(buyerName);

    await page.getByRole("link", { name: "New project" }).first().click();
    await page.getByLabel("Project name").fill(`Stoneware mugs ${w.runId}`);
    await page.getByLabel(/^Brief/).fill("1,200 glazed stoneware mugs, 350 ml, two colours.");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel(/^Brief/)).toHaveValue(/1,200 glazed stoneware mugs/);
    await page
      .getByLabel(/^Brief/)
      .fill("1,500 glazed stoneware mugs, 350 ml, two colours, gift box.");
    await page.getByRole("button", { name: "Save brief" }).click();
    await expect(page.getByRole("status")).toContainText("Brief saved.");

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible();
    await page.getByLabel("Organization type").selectOption("supplier");
    await page.getByLabel("Legal name").fill(`${supplierName} Co., Ltd.`);
    await page.getByLabel("Display name", { exact: true }).fill(supplierName);
    await page.getByLabel(/^Chinese display name/).fill(`宁波示例陶瓷 ${w.runId}`);
    await page.getByLabel("Country").fill("CN");
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page).toHaveURL(/\/supplier$/);
    await expect(page.getByTestId("active-org")).toHaveText(`宁波示例陶瓷 ${w.runId}`);

    await page.getByLabel("切换组织").selectOption({ label: `${buyerName} · 所有者` });
    await page.getByRole("button", { name: "切换" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("active-org")).toHaveText(buyerName);
    await expect(page.getByRole("list", { name: "Projects" })).toContainText(
      `Stoneware mugs ${w.runId}`,
    );
  });
});
