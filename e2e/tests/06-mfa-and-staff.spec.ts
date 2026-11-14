/**
 * B-05b (ADR-043): internal roles need a verified TOTP challenge (assurance level aal2) before /ops opens, in the web
 * guard and in the database; platform admins provision staff without SQL. TOTP codes are computed here from the setup
 * key Supabase Auth returned at enrolment (support/totp.ts), exactly as an authenticator app would.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "../support/env";
import {
  contextFor,
  expectNotFound,
  field,
  signIn,
  signInStaff,
  staffCode,
  submitTotp,
  world,
} from "../support/helpers";
import { freshTotp, totpAt, totpStep } from "../support/totp";

// A spec may wait up to one 30-second TOTP step per code so that no code is used twice.
test.describe.configure({ timeout: 180_000 });

const ENROLL = /\/ops\/mfa\/enroll$/;
const VERIFY = /\/ops\/mfa\/verify$/;

/** A code that is wrong for the current and both neighbouring steps. */
function wrongCode(secret: string): string {
  const step = totpStep();
  const valid = new Set([step - 1, step, step + 1].map((s) => totpAt(secret, s)));
  for (let n = 0; ; n++) {
    const candidate = String((123_456 + n * 7_919) % 1_000_000).padStart(6, "0");
    if (!valid.has(candidate)) return candidate;
  }
}

/** Start enrolment on the page, read the setup key shown once, and confirm with a code computed from it. */
async function enrolThroughUi(page: Page): Promise<string> {
  await expect(page).toHaveURL(ENROLL);
  await page.getByRole("button", { name: "Set up an authenticator app", exact: true }).click();
  const secret = ((await page.getByTestId("totp-secret").textContent()) ?? "").trim();
  expect(secret).toMatch(/^[A-Z2-7]{16,}=*$/);
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  await submitTotp(page, await freshTotp(secret), "Confirm and continue");
  return secret;
}

test.describe("MFA for internal roles and staff provisioning", () => {
  test("an operator without a factor is sent to enrolment from every /ops URL", async ({
    page,
  }) => {
    const w = world();
    await signIn(page, "opNoMfa");
    await expect(page).toHaveURL(ENROLL);
    await expect(
      page.getByRole("heading", { name: "Set up two-step sign-in", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("mfa-account")).toHaveText(w.users.opNoMfa.email);
    const project = `/ops/projects/${w.projects.a}`;
    for (const [path, expected] of [
      ["/ops", "/ops/mfa/enroll"],
      [project, `/ops/mfa/enroll?next=${encodeURIComponent(project)}`],
      ["/ops/admin/staff", "/ops/mfa/enroll?next=%2Fops%2Fadmin%2Fstaff"],
      ["/ops/mfa/verify", "/ops/mfa/enroll"],
    ] as const) {
      await page.goto(path);
      await expect(page, path).toHaveURL(expected);
      await expect(page.getByRole("list", { name: "Projects" })).toHaveCount(0);
    }
  });

  test("with only a password an assigned operator reads no ops data, in the app or straight through the Data API", async ({
    page,
  }) => {
    const w = world();
    const env = e2eEnv();
    const project = `/ops/projects/${w.projects.a}`;

    // The app: the password alone ends at the challenge, also for a direct URL; a wrong code is refused.
    await signIn(page, "opAssigned");
    await expect(page).toHaveURL(VERIFY);
    await page.goto(project);
    await expect(page).toHaveURL(`/ops/mfa/verify?next=${encodeURIComponent(project)}`);
    await expect(page.getByTestId("brief-text")).toHaveCount(0);
    await submitTotp(page, wrongCode(w.totp.opAssigned.secret), "Continue");
    await expect(page.getByText(/That code did not match/)).toBeVisible();
    await expect(page).toHaveURL(/\/ops\/mfa\/verify\?next=/);
    // The right code continues to where the browser was going.
    await submitTotp(page, await staffCode("opAssigned"), "Continue");
    await expect(page).toHaveURL(project);
    await expect(page.getByTestId("brief-text")).toContainText(`Brief A ${w.runId}`);

    // The Data API with the same password (no web guard in the way): RLS ignores the operator role at aal1.
    const api = createClient(env.supabaseUrl, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await api.auth.signInWithPassword({
      email: w.users.opAssigned.email,
      password: w.password,
    });
    expect(signInError).toBeNull();
    const aal1 = await api.from("sourcing_projects").select("id").eq("id", w.projects.a);
    expect(aal1.error).toBeNull();
    expect(aal1.data).toEqual([]);
    const briefs = await api.from("buyer_briefs").select("id").eq("project_id", w.projects.a);
    expect(briefs.data).toEqual([]);
    const { data: factors } = await api.auth.mfa.listFactors();
    const factorId = factors?.totp[0]?.id ?? "";
    const { error: verifyError } = await api.auth.mfa.challengeAndVerify({
      factorId,
      code: await staffCode("opAssigned"),
    });
    expect(verifyError).toBeNull();
    const aal2 = await api.from("sourcing_projects").select("id").eq("id", w.projects.a);
    expect(aal2.data).toEqual([{ id: w.projects.a }]);

    // Supabase Auth ends the user's other aal1 sessions when one of them verifies a factor; the browser's session is
    // aal2, so it survives.
    await page.reload();
    await expect(page).toHaveURL(project);
    await expect(page.getByTestId("brief-text")).toContainText(`Brief A ${w.runId}`);
  });

  test("a factor verified in one session signs the same user's password-only sessions out", async ({
    page,
  }) => {
    const w = world();
    const env = e2eEnv();
    // Browser: password only (aal1), parked on the challenge.
    await signIn(page, "opUnassigned");
    await expect(page).toHaveURL(VERIFY);
    // Elsewhere, the same user completes a challenge.
    const api = createClient(env.supabaseUrl, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await api.auth.signInWithPassword({ email: w.users.opUnassigned.email, password: w.password });
    const { data: factors } = await api.auth.mfa.listFactors();
    const { error } = await api.auth.mfa.challengeAndVerify({
      factorId: factors?.totp[0]?.id ?? "",
      code: await staffCode("opUnassigned"),
    });
    expect(error).toBeNull();
    // The parked aal1 browser session is gone: it must sign in again.
    await page.goto("/ops");
    await expect(page).toHaveURL("/sign-in?next=%2Fops");
  });

  test("an operator enrols with the setup key shown once and reaches /ops; the next sign-in asks for a code", async ({
    page,
  }) => {
    await signIn(page, "opNoMfa");
    const secret = await enrolThroughUi(page);
    await expect(page).toHaveURL(/\/ops$/);
    await expect(page.getByText("No assigned projects")).toBeVisible();
    // Enrolled and at aal2: the MFA pages just continue to /ops.
    await page.goto("/ops/mfa/enroll");
    await expect(page).toHaveURL(/\/ops$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn(page, "opNoMfa");
    await expect(page).toHaveURL(VERIFY);
    await page.goto("/ops/mfa/enroll");
    await expect(page).toHaveURL(VERIFY); // a second factor cannot be added from aal1
    await submitTotp(page, await freshTotp(secret), "Continue");
    await expect(page).toHaveURL(/\/ops$/);
  });

  test("a platform admin provisions an operator without SQL; they accept, enrol and reach /ops; suspension ends their session", async ({
    page,
    browser,
  }) => {
    const w = world();
    const email = w.users.staffInvitee.email;
    await signInStaff(page, "platformAdmin");
    await expect(page).toHaveURL(/\/ops$/);
    await page.getByRole("link", { name: "Staff", exact: true }).click();
    await expect(page).toHaveURL(/\/ops\/admin\/staff$/);
    await expect(page.getByRole("heading", { name: "Internal staff", level: 1 })).toBeVisible();

    // Active staff cannot be invited again.
    await field(page, "Email").fill(w.users.opAssigned.email);
    await page.getByRole("button", { name: "Create staff invitation" }).click();
    await expect(
      page.getByText("That address already belongs to an active staff member."),
    ).toBeVisible();

    await field(page, "Email").fill(email);
    await field(page, "Role").selectOption("operator");
    await page.getByRole("button", { name: "Create staff invitation" }).click();
    const url = ((await page.getByTestId("staff-invite-url").textContent()) ?? "").trim();
    const invitePath = new URL(url).pathname;
    expect(invitePath).toMatch(/^\/invite\/[0-9a-f]{64}$/);
    await page.reload();
    await expect(page.getByTestId("staff-invite-url")).toHaveCount(0); // shown once
    await expect(page.getByTestId("staff-pending")).toContainText(email);

    // The invitee has an account and no membership; they accept, then must enrol before /ops opens.
    const invitee = await contextFor(browser, "staffInvitee");
    await expect(invitee.page).toHaveURL(/\/onboarding$/);
    await invitee.page.goto(invitePath);
    await invitee.page.getByRole("button", { name: "Accept invitation" }).click();
    await enrolThroughUi(invitee.page);
    await expect(invitee.page).toHaveURL(/\/ops$/);
    await expect(invitee.page.getByText("No assigned projects")).toBeVisible();

    // The admin now sees them as an operator, and suspends them: their next request needs a new sign-in.
    await page.reload();
    await expect(page.getByTestId("staff-pending")).toHaveCount(0);
    const row = page.getByTestId("staff-row").filter({ hasText: email });
    await expect(row).toContainText("Operator");
    await row.getByLabel(`Status for ${email}`).selectOption("suspended");
    await row.getByRole("button", { name: "Update" }).click();
    await expect(row.getByRole("status")).toContainText("Staff membership updated.");
    await invitee.page.goto("/ops");
    await expect(invitee.page).toHaveURL("/sign-in?next=%2Fops");
    await invitee.context.close();
  });

  test("only platform admins open the staff page; buyers get the same 404 on every /ops URL, signed-out visitors sign in", async ({
    page,
    browser,
  }) => {
    await signInStaff(page, "opUnassigned");
    await expect(page).toHaveURL(/\/ops$/);
    await expect(page.getByRole("link", { name: "Staff", exact: true })).toHaveCount(0);
    await expectNotFound(page, "/ops/admin/staff");

    const buyer = await contextFor(browser, "buyerAOwner");
    for (const path of ["/ops/admin/staff", "/ops/mfa/enroll", "/ops/mfa/verify"]) {
      await expectNotFound(buyer.page, path);
    }
    await buyer.context.close();

    const visitor = await browser.newContext();
    const anon = await visitor.newPage();
    await anon.goto("/ops/mfa/verify");
    await expect(anon).toHaveURL("/sign-in?next=%2Fops");
    await visitor.close();
  });
});
