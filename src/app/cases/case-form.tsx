"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { CaseFormOptions, CaseFormValues } from "@/lib/case-admin";
import { humanize } from "@/lib/format";

import type { CaseFormState } from "./actions";

type Props = {
  action: (prev: CaseFormState, form: FormData) => Promise<CaseFormState>;
  options: CaseFormOptions;
  initial: CaseFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function CaseForm({ action, options, initial, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state.values ?? initial;
  const err = state.errors ?? {};

  // key forces React to reset defaultValues after a failed submit.
  const key = JSON.stringify(v);

  const field = (name: keyof CaseFormValues, label: string, control: React.ReactNode, hint?: string) => (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      {control}
      {err[name] ? (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {err[name]}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
  const invalid = (name: keyof CaseFormValues) =>
    err[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};

  return (
    <form action={formAction} key={key} className="grid gap-6">
      <fieldset className="grid items-start gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Case number</legend>
        {field(
          "case_type_id",
          "Case type",
          <NativeSelect id="case_type_id" name="case_type_id" defaultValue={v.case_type_id} required {...invalid("case_type_id")}>
            <option value="">Choose…</option>
            {options.caseTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}: {t.name}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field(
          "case_number",
          "Number",
          <Input id="case_number" name="case_number" inputMode="numeric" defaultValue={v.case_number} required {...invalid("case_number")} />,
        )}
        {field(
          "case_year",
          "Year",
          <Input id="case_year" name="case_year" inputMode="numeric" defaultValue={v.case_year} required {...invalid("case_year")} />,
        )}
      </fieldset>

      <fieldset className="grid items-start gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Court and FIR</legend>
        {field(
          "court_id",
          "Court",
          <NativeSelect id="court_id" name="court_id" defaultValue={v.court_id} required {...invalid("court_id")}>
            <option value="">Choose…</option>
            {options.courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>,
          "Changing the court of an existing case is recorded as a transfer.",
        )}
        {field(
          "fir_id",
          "FIR",
          <NativeSelect id="fir_id" name="fir_id" defaultValue={v.fir_id} {...invalid("fir_id")}>
            <option value="">None</option>
            {options.firs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </NativeSelect>,
          "G.R. cases only.",
        )}
      </fieldset>

      <fieldset className="grid items-start gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Progress</legend>
        {field(
          "stage",
          "Stage",
          <NativeSelect id="stage" name="stage" defaultValue={v.stage} {...invalid("stage")}>
            <option value="">Not recorded</option>
            {options.stages.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field(
          "status",
          "Status",
          <NativeSelect id="status" name="status" defaultValue={v.status} required {...invalid("status")}>
            {options.statuses.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field(
          "disposal_mode",
          "Disposal mode",
          <NativeSelect id="disposal_mode" name="disposal_mode" defaultValue={v.disposal_mode} {...invalid("disposal_mode")}>
            <option value="">None</option>
            {options.disposalModes.map((m) => (
              <option key={m} value={m}>
                {humanize(m)}
              </option>
            ))}
          </NativeSelect>,
          "Required when disposed.",
        )}
      </fieldset>

      <fieldset className="grid items-start gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Dates</legend>
        {field("filed_on", "Filed", <Input id="filed_on" name="filed_on" type="date" defaultValue={v.filed_on} {...invalid("filed_on")} />)}
        {field(
          "registered_on",
          "Registered",
          <Input id="registered_on" name="registered_on" type="date" defaultValue={v.registered_on} {...invalid("registered_on")} />,
        )}
        {field(
          "disposed_on",
          "Disposed",
          <Input id="disposed_on" name="disposed_on" type="date" defaultValue={v.disposed_on} {...invalid("disposed_on")} />,
          "Required when disposed.",
        )}
      </fieldset>

      {state.formError ? (
        <p role="alert" className="text-destructive text-sm">
          {state.formError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
