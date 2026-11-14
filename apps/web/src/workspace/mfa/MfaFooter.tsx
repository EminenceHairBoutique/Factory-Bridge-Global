/** Footer for the MFA pages: who is signed in, what to do without the device, and a way out (server component). */
import { signOut } from "@/app/(auth)/actions";
import { MFA_COPY } from "../copy";

export function MfaFooter({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p>{MFA_COPY.lostDevice}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="break-all" data-testid="mfa-account">
          {email}
        </span>
        <form action={signOut}>
          <button type="submit" className="font-medium text-(--fbg-action-primary) underline">
            {MFA_COPY.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
