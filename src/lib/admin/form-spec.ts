// Field specs shared by the admin forms (rendered by components/admin/
// admin-form.tsx) and their server-side validation (lib/admin/validate.ts).
// One spec drives both, so a form cannot offer a value the server rejects,
// or accept one it does not check.

export type Option = { value: string; label: string };

export type FieldSpec = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "date" | "select";
  options?: Option[]; // select: the only values accepted
  required?: boolean;
  maxLength?: number; // text and textarea (defaults 200 and 2000)
  hint?: string;
  wide?: boolean; // span the full form width
};

export type FormState = {
  values?: Record<string, string>;
  errors?: Record<string, string>;
  formError?: string;
};

// URL segment <-> record kind, for /admin/cases/[id]/[kind]/...
export const SEGMENT_KIND = { parties: "party", hearings: "hearing", orders: "order" } as const;
export type Segment = keyof typeof SEGMENT_KIND;
export const isSegment = (s: string): s is Segment => s in SEGMENT_KIND;
