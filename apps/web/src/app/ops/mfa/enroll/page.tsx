import { redirect } from "next/navigation";
import { requireStaffForMfa } from "@/server/auth/guard";
import { afterMfaPath, mfaHref } from "@/server/auth/paths";
import { AuthCard } from "@/workspace/AuthCard";
import { MFA_COPY } from "@/workspace/copy";
import { MfaFooter } from "@/workspace/mfa/MfaFooter";
import { TotpEnrollForm } from "@/workspace/mfa/MfaForms";

export const dynamic = "force-dynamic";

/**
 * TOTP enrolment for internal staff without a verified factor (B-05b, ADR-043). Buyers and suppliers get the same 404
 * as on any /ops URL; staff already at aal2 continue, and staff with a factor go to the challenge instead. Nothing is
 * enrolled on GET: the setup starts from a POSTed server action, so a prefetch or a reload cannot create factors.
 */
export default async function MfaEnrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = afterMfaPath((await searchParams)["next"]);
  const { user, assurance } = await requireStaffForMfa(next);
  if (assurance.level === "aal2") redirect(next);
  if (assurance.hasVerifiedFactor) redirect(mfaHref("verify", next));
  return (
    <AuthCard
      title={MFA_COPY.enrollTitle}
      lead={MFA_COPY.enrollLead}
      footer={<MfaFooter email={user.email} />}
    >
      <TotpEnrollForm next={next} />
    </AuthCard>
  );
}
