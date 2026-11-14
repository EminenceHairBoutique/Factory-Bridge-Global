import type { Metadata } from "next";
import Link from "next/link";
import "@/design-preview/design-preview.css";
import { currentSession } from "@/server/auth/guard";
import { SIGN_IN_PATH, SIGN_UP_PATH, isInviteToken } from "@/server/auth/paths";
import { AuthCard } from "@/workspace/AuthCard";
import { INVITE_COPY, AUTH_COPY } from "@/workspace/copy";
import { AcceptInviteForm } from "@/workspace/invite/AcceptInviteForm";
import { Notice, buttonClasses } from "@/workspace/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Invitation — Factory Bridge Global",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The token sits in the path (it is the whole credential, single-use and bound to one email address). The page sends
 * Referrer-Policy: no-referrer (next.config.ts and the meta tag) and loads no third-party resources, so the link
 * cannot leak through a Referer header. Nothing about the inviting organization is shown before acceptance.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isInviteToken(token)) {
    return (
      <AuthCard title={INVITE_COPY.title}>
        <Notice tone="danger" title={INVITE_COPY.malformed} />
      </AuthCard>
    );
  }
  const session = await currentSession();
  if (session.status === "not_configured") {
    return (
      <AuthCard title={INVITE_COPY.title}>
        <Notice tone="warn" title={AUTH_COPY.notConfigured} />
      </AuthCard>
    );
  }
  const next = encodeURIComponent(`/invite/${token}`);
  if (session.status === "signed_out") {
    return (
      <AuthCard title={INVITE_COPY.title} lead={INVITE_COPY.lead}>
        <p className="text-[15px] text-(--fbg-text-secondary)">{INVITE_COPY.signedOutBody}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`${SIGN_IN_PATH}?next=${next}`} className={buttonClasses("primary", "md")}>
            Sign in
          </Link>
          <Link href={`${SIGN_UP_PATH}?next=${next}`} className={buttonClasses("secondary", "md")}>
            Create an account
          </Link>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={INVITE_COPY.title}
      lead={INVITE_COPY.lead}
      footer={
        <>
          Signed in as <span data-testid="signed-in-email">{session.user.email}</span>
        </>
      }
    >
      <AcceptInviteForm token={token} />
    </AuthCard>
  );
}
