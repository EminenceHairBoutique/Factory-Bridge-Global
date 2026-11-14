"use client";

import { useActionState } from "react";
import { createProject, saveBrief, type BuyerFormState } from "@/app/app/actions";
import { BUYER_COPY } from "../copy";
import { Button, Field, Notice, TextArea, TextInput } from "../ui";

const INITIAL: BuyerFormState = {};

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, INITIAL);
  const v = state.values ?? {};
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      {state.error ? <Notice tone="danger" title={state.error} /> : null}
      <Field label={BUYER_COPY.projectName} htmlFor="project-name" required error={err["name"]}>
        <TextInput
          id="project-name"
          name="name"
          required
          minLength={2}
          maxLength={160}
          defaultValue={v["name"] ?? ""}
        />
      </Field>
      <Field
        label={BUYER_COPY.briefLabel}
        htmlFor="project-brief"
        hint={BUYER_COPY.briefHint}
        error={err["brief"]}
      >
        <TextArea
          id="project-brief"
          name="brief"
          rows={8}
          maxLength={20000}
          defaultValue={v["brief"] ?? ""}
        />
      </Field>
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          Create project
        </Button>
      </div>
    </form>
  );
}

export function BriefEditor({
  projectId,
  briefId,
  initial,
}: {
  projectId: string;
  briefId: string | null;
  initial: string;
}) {
  const [state, action, pending] = useActionState(saveBrief, INITIAL);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      {state.error ? <Notice tone="danger" title={state.error} /> : null}
      {state.notice ? (
        <div role="status">
          <Notice tone="ok" title={state.notice} />
        </div>
      ) : null}
      <input type="hidden" name="projectId" value={projectId} />
      {briefId ? <input type="hidden" name="briefId" value={briefId} /> : null}
      <Field
        label={BUYER_COPY.briefLabel}
        htmlFor="brief-text"
        required
        hint={BUYER_COPY.briefHint}
        error={err["brief"]}
      >
        <TextArea
          id="brief-text"
          name="brief"
          rows={10}
          required
          maxLength={20000}
          defaultValue={state.values?.["brief"] ?? initial}
        />
      </Field>
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          {BUYER_COPY.saveBrief}
        </Button>
      </div>
    </form>
  );
}
