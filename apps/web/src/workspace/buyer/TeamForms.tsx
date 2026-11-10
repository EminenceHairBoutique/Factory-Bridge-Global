"use client";

import { useActionState } from "react";
import {
  changeMembership,
  createInvite,
  type TeamFormState,
} from "@/app/app/settings/team/actions";
import { GRANTABLE_ROLES } from "@/server/auth/schemas";
import { BUYER_COPY } from "../copy";
import { Button, Field, Notice, Select, TextInput } from "../ui";

const INITIAL: TeamFormState = {};
const ROLE_LABEL: Record<(typeof GRANTABLE_ROLES)[number], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice tone="danger" title={state.error} /> : null}
      {state.inviteUrl ? (
        <div role="status">
          <Notice tone="ok" title={BUYER_COPY.inviteCreated}>
            <code className="block break-all select-all" data-testid="invite-url">
              {state.inviteUrl}
            </code>
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Email" htmlFor="invite-email" required error={state.fieldErrors?.["email"]}>
          <TextInput
            id="invite-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
          />
        </Field>
        <Field label="Role" htmlFor="invite-role" required>
          <Select id="invite-role" name="role" defaultValue="member">
            {GRANTABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-(--fbg-text-secondary)">{BUYER_COPY.inviteHint}</p>
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          {BUYER_COPY.invite}
        </Button>
      </div>
    </form>
  );
}

export function MembershipForm({
  membershipId,
  email,
  role,
  status,
}: {
  membershipId: string;
  email: string;
  role: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(changeMembership, INITIAL);
  const slug = membershipId.slice(0, 8);
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3"
      aria-label={`Membership of ${email}`}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`role-${slug}`} className="text-xs text-(--fbg-text-secondary)">
          Role for {email}
        </label>
        <Select id={`role-${slug}`} name="role" defaultValue={role}>
          {GRANTABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`status-${slug}`} className="text-xs text-(--fbg-text-secondary)">
          Status for {email}
        </label>
        <Select id={`status-${slug}`} name="status" defaultValue={status}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>
      <Button type="submit" size="sm" loading={pending}>
        Save
      </Button>
      {state.error ? (
        <span className="text-xs text-(--fbg-status-danger)">{state.error}</span>
      ) : null}
      {state.notice ? (
        <span role="status" className="text-xs text-(--fbg-status-success)">
          {state.notice}
        </span>
      ) : null}
    </form>
  );
}
