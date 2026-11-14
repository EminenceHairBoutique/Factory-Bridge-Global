import Link from "next/link";
import { readPendingOtpEmail } from "@/server/auth/cookies";
import { SIGN_IN_PATH, safeNextPath } from "@/server/auth/paths";
import { resolveSupabaseConfig } from "@/server/auth/config";
import { AuthCard } from "@/workspace/AuthCard";
import { CodeVerifyForm } from "@/workspace/auth/AuthForms";
import { AUTH_COPY } from "@/workspace/copy";
import { Notice } from "@/workspace/ui";

export const dynamic = "force-dynamic";

/** a•••@example.com — enough for the visitor to recognise the address, nothing more. */
function mask(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

export default async function SignInCodePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath((await searchParams)["next"]);
  const back = next ? `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}` : SIGN_IN_PATH;
  if (!resolveSupabaseConfig()) {
    return (
      <AuthCard title={AUTH_COPY.codeTitle}>
        <Notice tone="warn" title={AUTH_COPY.notConfigured} />
      </AuthCard>
    );
  }
  const email = await readPendingOtpEmail();
  return (
    <AuthCard
      title={AUTH_COPY.codeTitle}
      lead={email ? `${AUTH_COPY.codeLead} (${mask(email)})` : undefined}
      footer={
        <Link href={back} className="font-medium text-(--fbg-action-primary) underline">
          Request a new code or use your password
        </Link>
      }
    >
      {email ? (
        <CodeVerifyForm next={next} />
      ) : (
        <Notice tone="warn" title={AUTH_COPY.codeSessionExpired} />
      )}
    </AuthCard>
  );
}
