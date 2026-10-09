import "server-only";
import postgres from "postgres";

import { getFilterOptions } from "@/lib/cases";
import type { AdminSession } from "@/lib/auth";
import { readDb as db } from "@/lib/db-read";
import { writeDb } from "@/lib/db-write";

// ---------------------------------------------------------------------------
// Form options and current values
// ---------------------------------------------------------------------------
export type CaseFormOptions = Awaited<ReturnType<typeof getFilterOptions>> & {
  firs: { id: number; label: string }[];
  disposalModes: string[];
};

export async function getCaseFormOptions(): Promise<CaseFormOptions> {
  const sql = db();
  const [base, firs, modes] = await Promise.all([
    getFilterOptions(),
    sql<{ id: number; label: string }[]>`
      SELECT id::int, fir_number || '/' || fir_year || ', ' || police_station || ' PS' AS label
      FROM firs ORDER BY police_station, fir_year, fir_number`,
    sql<{ v: string }[]>`SELECT unnest(enum_range(NULL::disposal_mode))::text AS v`,
  ]);
  return { ...base, firs: [...firs], disposalModes: modes.map((r) => r.v) };
}

// Field values as the form shows them: strings, "" for empty.
export type CaseFormValues = {
  case_type_id: string;
  case_number: string;
  case_year: string;
  court_id: string;
  fir_id: string;
  filed_on: string;
  registered_on: string;
  stage: string;
  status: string;
  disposal_mode: string;
  disposed_on: string;
};

export const EMPTY_CASE: CaseFormValues = {
  case_type_id: "",
  case_number: "",
  case_year: "",
  court_id: "",
  fir_id: "",
  filed_on: "",
  registered_on: "",
  stage: "",
  status: "pending",
  disposal_mode: "",
  disposed_on: "",
};

export async function getCaseFormValues(id: number): Promise<CaseFormValues | null> {
  const [row] = await db()<CaseFormValues[]>`
    SELECT case_type_id::text, case_number::text, case_year::text, court_id::text,
           coalesce(fir_id::text, '') AS fir_id,
           coalesce(filed_on::text, '') AS filed_on,
           coalesce(registered_on::text, '') AS registered_on,
           coalesce(stage::text, '') AS stage,
           status::text,
           coalesce(disposal_mode::text, '') AS disposal_mode,
           coalesce(disposed_on::text, '') AS disposed_on
    FROM cases WHERE id = ${id}`;
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Validation: every value is checked against known options or a strict
// format before it reaches a query.
// ---------------------------------------------------------------------------
export type FieldErrors = Partial<Record<keyof CaseFormValues, string>>;

type CaseInput = {
  case_type_id: number;
  case_number: number;
  case_year: number;
  court_id: number;
  fir_id: number | null;
  filed_on: string | null;
  registered_on: string | null;
  stage: string | null;
  status: string;
  disposal_mode: string | null;
  disposed_on: string | null;
};

const isDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export function readCaseForm(form: FormData) {
  const values = Object.fromEntries(
    (Object.keys(EMPTY_CASE) as (keyof CaseFormValues)[]).map((k) => [k, String(form.get(k) ?? "").trim()]),
  ) as CaseFormValues;
  return values;
}

export function validateCase(v: CaseFormValues, o: CaseFormOptions) {
  const errors: FieldErrors = {};
  const pick = <T,>(ok: boolean, val: T, key: keyof CaseFormValues, msg: string): T | null => {
    if (!ok) errors[key] = msg;
    return ok ? val : null;
  };

  const typeId = Number(v.case_type_id);
  const caseTypeId = pick(o.caseTypes.some((t) => t.id === typeId), typeId, "case_type_id", "Choose a case type.");
  const num = Number(v.case_number);
  const caseNumber = pick(/^\d{1,9}$/.test(v.case_number) && num > 0, num, "case_number", "Enter a positive whole number.");
  const yr = Number(v.case_year);
  const caseYear = pick(/^\d{4}$/.test(v.case_year) && yr >= 1950 && yr <= 2100, yr, "case_year", "Enter a year between 1950 and 2100.");
  const cId = Number(v.court_id);
  const courtId = pick(o.courts.some((c) => c.id === cId), cId, "court_id", "Choose a court.");

  const firId = v.fir_id === "" ? null : pick(o.firs.some((f) => String(f.id) === v.fir_id), Number(v.fir_id), "fir_id", "Choose an FIR from the list.");
  const date = (k: "filed_on" | "registered_on" | "disposed_on") =>
    v[k] === "" ? null : pick(isDate(v[k]), v[k], k, "Enter a valid date.");
  const filedOn = date("filed_on");
  const registeredOn = date("registered_on");
  const disposedOn = date("disposed_on");

  const stage = v.stage === "" ? null : pick(o.stages.includes(v.stage), v.stage, "stage", "Choose a stage.");
  const status = pick(o.statuses.includes(v.status), v.status, "status", "Choose a status.");
  const mode = v.disposal_mode === "" ? null : pick(o.disposalModes.includes(v.disposal_mode), v.disposal_mode, "disposal_mode", "Choose a disposal mode.");

  if (Object.keys(errors).length) return { errors, input: null };
  const input: CaseInput = {
    case_type_id: caseTypeId!,
    case_number: caseNumber!,
    case_year: caseYear!,
    court_id: courtId!,
    fir_id: firId,
    filed_on: filedOn,
    registered_on: registeredOn,
    stage,
    status: status!,
    disposal_mode: mode,
    disposed_on: disposedOn,
  };
  return { errors, input };
}

// ---------------------------------------------------------------------------
// Saving: through db-write.ts (app_admin_user), in one transaction that names
// the admin, so the audit triggers record who changed status, stage or court.
// ---------------------------------------------------------------------------
export async function saveCase(admin: AdminSession, input: CaseInput, id: number | null): Promise<number | null> {
  const rows = await writeDb(admin, async (sql) => {
    const v = input;
    if (id === null) {
      return sql<{ id: string }[]>`
        INSERT INTO cases (case_type_id, case_number, case_year, court_id, fir_id, filed_on,
                           registered_on, stage, status, disposal_mode, disposed_on)
        VALUES (${v.case_type_id}, ${v.case_number}, ${v.case_year}, ${v.court_id}, ${v.fir_id},
                ${v.filed_on}::date, ${v.registered_on}::date, ${v.stage}::case_stage,
                ${v.status}::case_status, ${v.disposal_mode}::disposal_mode, ${v.disposed_on}::date)
        RETURNING id`;
    }
    return sql<{ id: string }[]>`
      UPDATE cases SET
        case_type_id = ${v.case_type_id}, case_number = ${v.case_number}, case_year = ${v.case_year},
        court_id = ${v.court_id}, fir_id = ${v.fir_id},
        filed_on = ${v.filed_on}::date, registered_on = ${v.registered_on}::date,
        stage = ${v.stage}::case_stage, status = ${v.status}::case_status,
        disposal_mode = ${v.disposal_mode}::disposal_mode, disposed_on = ${v.disposed_on}::date
      WHERE id = ${id}
      RETURNING id`;
  });
  return rows.length ? Number(rows[0].id) : null;
}

// The schema enforces the case rules with named constraints and triggers
// (004, 011). Turn those errors into messages for the form.
const CONSTRAINT_MESSAGES: Record<string, { field?: keyof CaseFormValues; message: string }> = {
  cases_case_type_id_case_number_case_year_key: {
    field: "case_number",
    message: "A case with this type, number and year already exists.",
  },
  cases_disposed_on_matches_status: {
    field: "disposed_on",
    message: "A disposed case needs a disposal date, and only a disposed case can have one.",
  },
  cases_disposal_mode_matches_status: {
    field: "disposal_mode",
    message: "A disposed case needs a disposal mode, and only a disposed case can have one.",
  },
  cases_registered_on_after_filed_on: { field: "registered_on", message: "Registration cannot be before filing." },
  cases_disposed_on_after_filed_on: { field: "disposed_on", message: "Disposal cannot be before filing." },
  cases_case_number_check: { field: "case_number", message: "Enter a positive whole number." },
  cases_case_year_check: { field: "case_year", message: "Enter a year between 1950 and 2100." },
};

export function describeDbError(e: unknown): { field?: keyof CaseFormValues; message: string } | null {
  if (!(e instanceof postgres.PostgresError)) return null;
  if (e.constraint_name && CONSTRAINT_MESSAGES[e.constraint_name]) return CONSTRAINT_MESSAGES[e.constraint_name];
  if (e.message.startsWith("cases_fir_only_on_gr:")) {
    return { field: "fir_id", message: "Only a G.R. (police) case can have an FIR." };
  }
  return null;
}
