import { expect, test } from "@playwright/test";
import { expectNotFound, signIn, signInStaff, world } from "../support/helpers";

test.describe("supplier and internal workspaces", () => {
  test("a supplier lands on the zh-CN supplier workspace and cannot open /app or /ops", async ({
    page,
  }) => {
    const w = world();
    await signIn(page, "supplierOwner");
    await expect(page).toHaveURL(/\/supplier$/);
    await expect(page.getByRole("heading", { name: "工作台", level: 1 })).toBeVisible();
    await expect(page.locator('[lang="zh-CN"]').first()).toBeVisible();
    await expect(page.getByTestId("active-org")).toHaveText(`深圳示例包装 ${w.runId}`);
    await expectNotFound(page, "/app");
    await expectNotFound(page, `/app/projects/${w.projects.a}`);
    await expectNotFound(page, "/ops");
  });

  test("the assigned operator sees project A only, by list and by URL; buyer and supplier workspaces stay closed", async ({
    page,
  }) => {
    const w = world();
    await signInStaff(page, "opAssigned");
    await expect(page).toHaveURL(/\/ops$/);
    const list = page.getByRole("list", { name: "Projects" });
    await expect(list).toContainText(`Kraft mailer boxes ${w.runId}`);
    await expect(list).not.toContainText(`Canvas tote bags ${w.runId}`);
    await page.goto(`/ops/projects/${w.projects.a}`);
    await expect(page.getByTestId("brief-text")).toContainText(`Brief A ${w.runId}`);
    await expectNotFound(page, `/ops/projects/${w.projects.b}`);
    await expectNotFound(page, "/app");
    await expectNotFound(page, `/app/projects/${w.projects.a}`);
    await expectNotFound(page, "/supplier");
  });

  test("an unassigned operator sees no projects, and a direct URL to one is a 404", async ({
    page,
  }) => {
    const w = world();
    await signInStaff(page, "opUnassigned");
    await expect(page).toHaveURL(/\/ops$/);
    await expect(page.getByText("No assigned projects")).toBeVisible();
    await expect(page.getByRole("list", { name: "Projects" })).toHaveCount(0);
    await expectNotFound(page, `/ops/projects/${w.projects.a}`);
    await expectNotFound(page, `/ops/projects/${w.projects.b}`);
  });
});
