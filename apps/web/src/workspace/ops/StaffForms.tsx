"use client";

/**
 * Staff provisioning forms for platform admins (B-05b). Plain forms posting to server actions; the server validates
 * everything again (schemas.ts) and SQL re-checks the caller (app.create_staff_invite, app.update_membership).
 */
import { useActionState } from "react";
import { STAFF_INVITABLE_ROLES } from "@fbg/domain/workspace";
import {
  changeStaffMembership,
  createStaffInvite,
  type StaffFormState,
} from "@/app/ops/admin/staff/actions";
import { STAFF_COPY } from "../copy";
import { Button, Field, Notice, Select, TextInput } from "../ui";

const INITIAL: StaffFormState = {};
export type StaffRole = (typeof STAFF_INVITABLE_ROLES)[number];
const ROLE_LABEL: Record<StaffRole, string> = {
  operator: "Operator",
  compliance_reviewer: "Compliance reviewer",
};

export function StaffInviteForm() {
  const [state, action, pending] = useActionState(createStaffInvite, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice tone="danger" title={state.error} /> : null}
      {state.inviteUrl ? (
        <div role="status">
          <Notice tone="ok" title={STAFF_COPY.inviteCreated}>
            <code className="block break-all select-all" data-testid="staff-invite-url">
              {state.inviteUrl}
            </code>
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field
          label="Email"
          htmlFor="staff-invite-email"
          required
          error={state.fieldErrors?.["email"]}
        >
          <TextInput
            id="staff-invite-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
          />
        </Field>
        <Field label="Role" htmlFor="staff-invite-role" required>
          <Select id="staff-invite-role" name="role" defaultValue="operator">
            {STAFF_INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-(--fbg-text-secondary)">{STAFF_COPY.inviteHint}</p>
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          {STAFF_COPY.invite}
        </Button>
      </div>
    </form>
  );
}

export function StaffMembershipForm({
  membershipId,
  email,
  role,
  status,
}: {
  membershipId: string;
  email: string;
  role: StaffRole;
  status: string;
}) {
  const [state, action, pending] = useActionState(changeStaffMembership, INITIAL);
  const slug = membershipId.slice(0, 8);
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3"
      aria-label={`Staff membership of ${email}`}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`staff-role-${slug}`} className="text-xs text-(--fbg-text-secondary)">
          Role for {email}
        </label>
        <Select id={`staff-role-${slug}`} name="role" defaultValue={role}>
          {STAFF_INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`staff-status-${slug}`} className="text-xs text-(--fbg-text-secondary)">
          Status for {email}
        </label>
        <Select id={`staff-status-${slug}`} name="status" defaultValue={status}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>
      <Button type="submit" size="sm" loading={pending}>
        Update
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
