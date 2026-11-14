import type { Metadata } from "next";
import Link from "next/link";
import "@/design-preview/design-preview.css";
import { WORKSPACE_PATH, landingWorkspace, workspaceForOrgType } from "@fbg/domain/workspace";
import { signOut } from "@/app/(auth)/actions";
import { requireSignedIn } from "@/server/auth/guard";
import { ONBOARDING_PATH } from "@/server/auth/paths";
import { AuthCard } from "@/workspace/AuthCard";
import { roleLabel } from "@/workspace/WorkspaceShell";
import { ONBOARDING_COPY } from "@/workspace/copy";
import { CreateOrganizationForm } from "@/workspace/onboarding/CreateOrganizationForm";
import { Button } from "@/workspace/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Set up your organization — Factory Bridge Global",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const { user, memberships } = await requireSignedIn(ONBOARDING_PATH);
  const usable = memberships.filter((m) => landingWorkspace([m], null) !== null);
  return (
    <AuthCard
      wide
      title={ONBOARDING_COPY.title}
      lead={ONBOARDING_COPY.lead}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Signed in as <span data-testid="signed-in-email">{user.email}</span>
          </span>
          <form action={signOut}>
            <Button type="submit" size="sm" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      }
    >
      {usable.length ? (
        <section aria-labelledby="your-workspaces" className="mb-8">
          <h2 id="your-workspaces" className="text-[17px] font-semibold">
            {ONBOARDING_COPY.yourWorkspaces}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {usable.map((m) => (
              <li key={m.orgId}>
                <Link
                  href={WORKSPACE_PATH[workspaceForOrgType(m.orgType)]}
                  className="flex items-center justify-between rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) px-4 py-3 text-sm hover:bg-(--fbg-hover)"
                >
                  <span className="font-medium">{m.orgName}</span>
                  <span className="text-(--fbg-text-secondary)">{roleLabel("en-US", m.role)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="create-org">
        <h2 id="create-org" className="mb-4 text-[17px] font-semibold">
          {ONBOARDING_COPY.createTitle}
        </h2>
        <CreateOrganizationForm />
      </section>
    </AuthCard>
  );
}
