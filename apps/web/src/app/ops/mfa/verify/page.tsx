import { redirect } from "next/navigation";
import { requireStaffForMfa } from "@/server/auth/guard";
import { afterMfaPath, mfaHref } from "@/server/auth/paths";
import { AuthCard } from "@/workspace/AuthCard";
import { MFA_COPY } from "@/workspace/copy";
import { MfaFooter } from "@/workspace/mfa/MfaFooter";
import { TotpVerifyForm } from "@/workspace/mfa/MfaForms";

export const dynamic = "force-dynamic";

/**
 * TOTP challenge for internal staff with a verified factor whose session is still aal1 (B-05b, ADR-043): after every
 * password or email-code sign-in. Buyers and suppliers get the same 404 as on any /ops URL.
 */
export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = afterMfaPath((await searchParams)["next"]);
  const { user, assurance } = await requireStaffForMfa(next);
  if (assurance.level === "aal2") redirect(next);
  if (!assurance.hasVerifiedFactor) redirect(mfaHref("enroll", next));
  return (
    <AuthCard
      title={MFA_COPY.verifyTitle}
      lead={MFA_COPY.verifyLead}
      footer={<MfaFooter email={user.email} />}
    >
      <TotpVerifyForm next={next} />
    </AuthCard>
  );
}
