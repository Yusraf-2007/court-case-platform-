"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { FieldSpec, FormState } from "@/lib/admin/form-spec";
import { cn } from "@/lib/utils";

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  initial: Record<string, string>;
  submitLabel: string;
  cancelHref: string;
  note?: React.ReactNode;
};

// One form renderer for parties, hearings and orders. The specs come from
// the server, which validates the submission against the same specs.
export function AdminForm({ action, fields, initial, submitLabel, cancelHref, note }: Props) {
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state.values ?? initial;
  const err = state.errors ?? {};

  return (
    <form action={formAction} key={JSON.stringify(v)} className="grid gap-6" noValidate>
      {state.formError ? (
        <p role="alert" className="border-destructive/40 bg-destructive/5 text-destructive rounded-sm border px-4 py-3 text-sm">
          {state.formError}
        </p>
      ) : null}
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {fields.map((f) => {
          const describedBy = err[f.name] ? `${f.name}-error` : f.hint ? `${f.name}-hint` : undefined;
          const common = {
            id: f.name,
            name: f.name,
            defaultValue: v[f.name] ?? "",
            required: f.required,
            "aria-invalid": err[f.name] ? true : undefined,
            "aria-describedby": describedBy,
          };
          return (
            <div key={f.name} className={cn("grid content-start gap-1.5", (f.wide || f.kind === "textarea") && "sm:col-span-2")}>
              <Label htmlFor={f.name} className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {f.label}
                {f.required ? <span className="text-maroon"> *</span> : null}
              </Label>
              {f.kind === "select" ? (
                <NativeSelect {...common}>
                  <option value="">{f.required ? "Choose…" : "None"}</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              ) : f.kind === "textarea" ? (
                <textarea
                  {...common}
                  rows={4}
                  maxLength={f.maxLength ?? 2000}
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                />
              ) : (
                <Input {...common} type={f.kind === "date" ? "date" : "text"} maxLength={f.kind === "text" ? (f.maxLength ?? 200) : undefined} />
              )}
              {err[f.name] ? (
                <p id={`${f.name}-error`} className="text-destructive text-sm">
                  {err[f.name]}
                </p>
              ) : f.hint ? (
                <p id={`${f.name}-hint`} className="text-muted-foreground text-xs">
                  {f.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {note}
      <div className="border-border flex items-center gap-3 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
