import { expect, test, type Page } from "@playwright/test";
import { contextFor, signIn, world } from "../support/helpers";

test.describe.configure({ mode: "serial" });

async function membershipForm(page: Page, email: string) {
  await page.goto("/app/settings/team");
  return page.getByRole("form", { name: `Membership of ${email}` });
}

test.describe("invitations and role changes", () => {
  let invitePath = "";

  test("an owner creates an invitation; the link is shown once", async ({ page }) => {
    const w = world();
    await signIn(page, "buyerAOwner");
    await page.goto("/app/settings/team");
    await page.getByLabel("Email", { exact: true }).fill(w.users.invitee.email);
    await page.getByLabel("Role", { exact: true }).selectOption("member");
    await page.getByRole("button", { name: "Create invitation" }).click();
    const url = await page.getByTestId("invite-url").textContent();
    invitePath = new URL(url ?? "").pathname;
    expect(invitePath).toMatch(/^\/invite\/[0-9a-f]{64}$/);
    await page.reload();
    await expect(page.getByTestId("invite-url")).toHaveCount(0);
    await expect(page.getByText(w.users.invitee.email)).toBeVisible(); // pending list, without the link
  });

  test("someone else's account cannot accept it", async ({ page }) => {
    await signIn(page, "buyerBOwner", invitePath);
    await expect(page).toHaveURL(invitePath);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(
      page.getByText("This invitation was issued to a different email address."),
    ).toBeVisible();
    await page.goto("/app");
    await expect(page.getByTestId("active-org")).toHaveText(world().names.buyerB);
  });

  test("the invitee signs in from the link, accepts, and lands in buyer A", async ({ page }) => {
    const w = world();
    const response = await page.goto(invitePath);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await signIn(page, "invitee", invitePath);
    await expect(page).toHaveURL(invitePath);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("active-org")).toHaveText(w.names.buyerA);
    await expect(page.getByRole("list", { name: "Projects" })).toContainText(
      `Kraft mailer boxes ${w.runId}`,
    );
    // single use
    await page.goto(invitePath);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.getByText(/not valid, has already been used, or has expired/)).toBeVisible();
  });

  test("demoting a member ends their session on the next request; they come back read-only", async ({
    browser,
  }) => {
    const w = world();
    const member = await contextFor(browser, "buyerAMember");
    await expect(member.page).toHaveURL(/\/app$/);
    await expect(member.page.getByRole("link", { name: "New project" }).first()).toBeVisible();

    const owner = await contextFor(browser, "buyerAOwner");
    const form = await membershipForm(owner.page, w.users.buyerAMember.email);
    await form.getByLabel(`Role for ${w.users.buyerAMember.email}`).selectOption("viewer");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("status")).toContainText("Membership updated.");

    // the member's existing session is gone: next navigation goes to sign-in
    await member.page.goto("/app");
    await expect(member.page).toHaveURL("/sign-in?next=%2Fapp");
    await signIn(member.page, "buyerAMember");
    await expect(member.page).toHaveURL(/\/app$/);
    await expect(
      member.page.getByText("You have view-only access in this organization."),
    ).toBeVisible();
    await expect(member.page.getByRole("link", { name: "New project" })).toHaveCount(0);

    // suspension: signed out again, and with no other membership they land on onboarding
    const again = await membershipForm(owner.page, w.users.buyerAMember.email);
    await again.getByLabel(`Status for ${w.users.buyerAMember.email}`).selectOption("suspended");
    await again.getByRole("button", { name: "Save" }).click();
    await expect(again.getByRole("status")).toContainText("Membership updated.");
    await member.page.goto(`/app/projects/${w.projects.a}`);
    await expect(member.page).toHaveURL(
      `/sign-in?next=${encodeURIComponent(`/app/projects/${w.projects.a}`)}`,
    );
    await signIn(member.page, "buyerAMember");
    await expect(member.page).toHaveURL(/\/onboarding$/);
    await member.page.goto(`/app/projects/${w.projects.a}`);
    await expect(member.page).toHaveURL(/\/onboarding$/);

    await member.context.close();
    await owner.context.close();
  });
});
