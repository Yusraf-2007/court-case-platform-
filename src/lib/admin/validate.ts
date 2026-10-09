import "server-only";
import postgres from "postgres";

import type { FieldSpec, FormState } from "@/lib/admin/form-spec";

export const isDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

// Check every submitted value against its spec. Only fields in the spec are
// read; anything else in the form is ignored. Clean values are trimmed
// strings, or null for an empty optional field.
export function validateFields(specs: FieldSpec[], form: FormData) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const clean: Record<string, string | null> = {};

  for (const f of specs) {
    const raw = form.get(f.name);
    const v = typeof raw === "string" ? raw.trim() : "";
    values[f.name] = v;
    if (v === "") {
      if (f.required) errors[f.name] = `${f.label} is required.`;
      clean[f.name] = null;
      continue;
    }
    if (f.kind === "date" && !isDate(v)) errors[f.name] = "Enter a valid date.";
    else if (f.kind === "select" && !f.options?.some((o) => o.value === v)) errors[f.name] = "Choose one of the listed options.";
    else if ((f.kind === "text" || f.kind === "textarea") && v.length > (f.maxLength ?? (f.kind === "text" ? 200 : 2000)))
      errors[f.name] = `Keep this under ${f.maxLength ?? (f.kind === "text" ? 200 : 2000)} characters.`;
    clean[f.name] = v;
  }
  return { values, errors, clean, ok: Object.keys(errors).length === 0 };
}

// The schema enforces the rules with named constraints and triggers. Turn a
// known one into a message for the form; anything else is logged and given
// a generic message.
export type ErrorMap = Record<string, { field?: string; message: string }>;

export function dbErrorState(e: unknown, map: ErrorMap, values: Record<string, string>, what: string): FormState {
  if (e instanceof postgres.PostgresError) {
    const byConstraint = e.constraint_name ? map[e.constraint_name] : undefined;
    const byPrefix = Object.entries(map).find(([k]) => e.message.startsWith(`${k}:`))?.[1];
    const known = byConstraint ?? byPrefix;
    if (known) {
      return known.field ? { values, errors: { [known.field]: known.message } } : { values, formError: known.message };
    }
    if (e.message.includes(":") && /^[a-z_]+:/.test(e.message)) {
      // A rule trigger rejected the write; its message names the rule.
      return { values, formError: `Refused by the database: ${e.message}` };
    }
  }
  console.error(`${what} failed`, e);
  return { values, formError: `The ${what} could not be saved. Please try again.` };
}
