"use client";

import { useActionState } from "react";
import { acceptInvite, type InviteState } from "@/app/invite/[token]/actions";
import { INVITE_COPY } from "../copy";
import { Button, Notice } from "../ui";

const INITIAL: InviteState = {};

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice tone="danger" title={state.error} /> : null}
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="primary" loading={pending}>
        {INVITE_COPY.accept}
      </Button>
    </form>
  );
}
