import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/guard";
import { ONBOARDING_PATH, SIGN_IN_PATH, safeNextPath } from "@/server/auth/paths";
import { AuthCard } from "@/workspace/AuthCard";
import { SignUpForm } from "@/workspace/auth/AuthForms";
import { AUTH_COPY } from "@/workspace/copy";
import { Notice } from "@/workspace/ui";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath((await searchParams)["next"]);
  const session = await currentSession();
  if (session.status === "not_configured") {
    return (
      <AuthCard title={AUTH_COPY.signUpTitle}>
        <Notice tone="warn" title={AUTH_COPY.notConfigured} />
      </AuthCard>
    );
  }
  if (session.status === "signed_in") redirect(next ?? ONBOARDING_PATH);
  const signInHref = next ? `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}` : SIGN_IN_PATH;
  return (
    <AuthCard
      title={AUTH_COPY.signUpTitle}
      lead={AUTH_COPY.signUpLead}
      footer={
        <>
          Already have an account?{" "}
          <Link href={signInHref} className="font-medium text-(--fbg-action-primary) underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
