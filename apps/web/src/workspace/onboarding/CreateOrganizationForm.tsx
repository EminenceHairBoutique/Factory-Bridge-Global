"use client";

import { useActionState } from "react";
import { createOrganization, type OnboardingState } from "@/app/onboarding/actions";
import { ONBOARDING_COPY } from "../copy";
import { Button, Field, Notice, Select, TextInput } from "../ui";

const INITIAL: OnboardingState = {};

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganization, INITIAL);
  const v = state.values ?? {};
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice tone="danger" title={state.error} /> : null}
      <Field label="Organization type" htmlFor="org-type" required error={err["orgType"]}>
        <Select id="org-type" name="orgType" defaultValue={v["orgType"] ?? "buyer"} required>
          <option value="buyer">{ONBOARDING_COPY.buyerOption}</option>
          <option value="supplier">{ONBOARDING_COPY.supplierOption}</option>
        </Select>
      </Field>
      <Field label="Legal name" htmlFor="org-legal" required error={err["legalName"]}>
        <TextInput
          id="org-legal"
          name="legalName"
          required
          maxLength={200}
          defaultValue={v["legalName"] ?? ""}
        />
      </Field>
      <Field label="Display name" htmlFor="org-display" required error={err["displayName"]}>
        <TextInput
          id="org-display"
          name="displayName"
          required
          maxLength={120}
          defaultValue={v["displayName"] ?? ""}
        />
      </Field>
      <Field
        label="Chinese display name (中文名称)"
        htmlFor="org-display-zh"
        error={err["displayNameZh"]}
      >
        <TextInput
          id="org-display-zh"
          name="displayNameZh"
          maxLength={120}
          lang="zh-CN"
          defaultValue={v["displayNameZh"] ?? ""}
        />
      </Field>
      <Field
        label="Country"
        htmlFor="org-country"
        required
        hint="Two-letter code, e.g. US or CN."
        error={err["country"]}
      >
        <TextInput
          id="org-country"
          name="country"
          required
          maxLength={2}
          autoComplete="country"
          defaultValue={v["country"] ?? "US"}
        />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>
        Create organization
      </Button>
    </form>
  );
}
