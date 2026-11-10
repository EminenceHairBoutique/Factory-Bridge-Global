import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession, landingPath, loadMemberships, preferredOrgId } from "@/server/auth/guard";
import { SIGN_UP_PATH, safeNextPath } from "@/server/auth/paths";
import { AuthCard } from "@/workspace/AuthCard";
import { CodeRequestForm, PasswordSignInForm } from "@/workspace/auth/AuthForms";
import { AUTH_COPY } from "@/workspace/copy";
import { Notice } from "@/workspace/ui";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath((await searchParams)["next"]);
  const session = await currentSession();
  if (session.status === "not_configured") {
    return (
      <AuthCard title={AUTH_COPY.signInTitle}>
        <Notice tone="warn" title={AUTH_COPY.notConfigured} />
      </AuthCard>
    );
  }
  if (session.status === "signed_in") {
    redirect(
      next ??
        landingPath(
          await loadMemberships(session.supabase, session.user.id),
          await preferredOrgId(),
        ),
    );
  }
  const signUpHref = next ? `${SIGN_UP_PATH}?next=${encodeURIComponent(next)}` : SIGN_UP_PATH;
  return (
    <AuthCard
      title={AUTH_COPY.signInTitle}
      lead={AUTH_COPY.signInLead}
      footer={
        <>
          New to Factory Bridge Global?{" "}
          <Link href={signUpHref} className="font-medium text-(--fbg-action-primary) underline">
            Create an account
          </Link>
        </>
      }
    >
      <PasswordSignInForm next={next} />
      <div className="my-6 flex items-center gap-3 text-xs text-(--fbg-text-secondary)">
        <span className="h-px flex-1 bg-(--fbg-border-divider)" />
        or
        <span className="h-px flex-1 bg-(--fbg-border-divider)" />
      </div>
      <CodeRequestForm next={next} />
    </AuthCard>
  );
}
