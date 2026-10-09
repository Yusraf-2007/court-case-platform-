import "server-only";

import type { AdminSession } from "@/lib/auth";
import type { FieldSpec, Option } from "@/lib/admin/form-spec";
import type { ErrorMap } from "@/lib/admin/validate";
import { readDb } from "@/lib/db-read";
import { writeDbTracked } from "@/lib/db-write";
import { formatDate, humanize } from "@/lib/format";

// Parties, hearings and orders of one case: the form specs (with options
// read from the database), the current values of a record, and its writes.
// Every write goes through writeDbTracked (db-write.ts), so it runs as the
// admin, is audited by migration 019's triggers, and returns a receipt.
// Every value is a bound parameter; ids come from the route, never the form.

export type Kind = "party" | "hearing" | "order";
export const KINDS: Kind[] = ["party", "hearing", "order"];

const enumOptions = async (type: "party_role" | "person_kind" | "hearing_outcome" | "adjournment_reason" | "order_type" | "disposal_mode") => {
  // The type name is one of the literals above, never request data.
  const rows = await readDb().unsafe<{ v: string }[]>(`SELECT unnest(enum_range(NULL::${type}))::text AS v`);
  return rows.map((r) => ({ value: r.v, label: humanize(r.v) }));
};

async function judgeOptions(): Promise<Option[]> {
  const rows = await readDb()<{ id: string; full_name: string; designation: string }[]>`
    SELECT id, full_name, designation FROM judges ORDER BY full_name`;
  return rows.map((j) => ({ value: j.id, label: `${j.full_name}, ${j.designation}` }));
}

async function hearingOptions(caseId: number): Promise<Option[]> {
  const rows = await readDb()<{ id: string; hearing_date: Date; outcome: string }[]>`
    SELECT id, hearing_date, outcome FROM hearings WHERE case_id = ${caseId} ORDER BY hearing_date DESC`;
  return rows.map((h) => ({ value: h.id, label: `${formatDate(h.hearing_date)} (${humanize(h.outcome)})` }));
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------
export async function fieldsFor(kind: Kind, caseId: number, editing: boolean): Promise<FieldSpec[]> {
  if (kind === "party") {
    const [roles, kinds] = await Promise.all([enumOptions("party_role"), enumOptions("person_kind")]);
    return [
      { name: "role", label: "Role in this case", kind: "select", options: roles, required: true },
      { name: "kind", label: "Kind", kind: "select", options: kinds, required: true },
      { name: "full_name", label: "Full name", kind: "text", required: true, maxLength: 160, wide: true },
      {
        name: "relation",
        label: "Relation",
        kind: "select",
        options: ["s/o", "w/o", "d/o"].map((r) => ({ value: r, label: r })),
        hint: "Individuals only, with the relative's name.",
      },
      { name: "relative_name", label: "Relative's name", kind: "text", maxLength: 160 },
      { name: "address", label: "Address", kind: "text", maxLength: 300, wide: true },
      { name: "district", label: "District", kind: "text", maxLength: 80 },
    ];
  }
  if (kind === "hearing") {
    const [judges, outcomes, reasons] = await Promise.all([judgeOptions(), enumOptions("hearing_outcome"), enumOptions("adjournment_reason")]);
    return [
      { name: "hearing_date", label: "Hearing date", kind: "date", required: true },
      { name: "outcome", label: "Outcome", kind: "select", options: outcomes, required: true },
      { name: "judge_id", label: "Presiding officer", kind: "select", options: judges, wide: true },
      { name: "purpose", label: "Purpose", kind: "text", maxLength: 200, wide: true, hint: "For example: prosecution evidence, PW-3." },
      { name: "adjournment_reason", label: "Adjournment reason", kind: "select", options: reasons, hint: "Only when the outcome is adjourned." },
      { name: "next_date", label: "Next date", kind: "date", hint: "Must be after the hearing date." },
    ];
  }
  const [types, judges, hearings, modes] = await Promise.all([
    enumOptions("order_type"),
    judgeOptions(),
    hearingOptions(caseId),
    enumOptions("disposal_mode"),
  ]);
  const fields: FieldSpec[] = [
    { name: "order_date", label: "Order date", kind: "date", required: true },
    { name: "order_type", label: "Order type", kind: "select", options: types, required: true },
    { name: "order_text", label: "Order", kind: "textarea", required: true, maxLength: 2000 },
    { name: "judge_id", label: "Judge", kind: "select", options: judges },
    { name: "hearing_id", label: "Passed at hearing", kind: "select", options: hearings },
  ];
  if (!editing) {
    fields.push(
      {
        name: "is_final",
        label: "Final order",
        kind: "select",
        options: [{ value: "yes", label: "Yes: this order disposes of the case" }],
        hint: "A final order disposes of the case (trigger orders_dispose_case).",
      },
      { name: "disposal_mode", label: "Disposal mode", kind: "select", options: modes, hint: "Final orders only. Needed unless the type is conviction, acquittal or dismissal." },
    );
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Current values (as form strings) and the case each record belongs to
// ---------------------------------------------------------------------------
export async function loadRecord(kind: Kind, caseId: number, id: number): Promise<Record<string, string> | null> {
  const sql = readDb();
  if (kind === "party") {
    const [r] = await sql<Record<string, string>[]>`
      SELECT cp.role::text, p.kind::text, p.full_name,
             coalesce(p.relation, '') AS relation, coalesce(p.relative_name, '') AS relative_name,
             coalesce(p.address, '') AS address, coalesce(p.district, '') AS district
      FROM case_parties cp JOIN persons p ON p.id = cp.person_id
      WHERE cp.id = ${id} AND cp.case_id = ${caseId}`;
    return r ?? null;
  }
  if (kind === "hearing") {
    const [r] = await sql<Record<string, string>[]>`
      SELECT hearing_date::text, outcome::text, coalesce(judge_id::text, '') AS judge_id,
             coalesce(purpose, '') AS purpose, coalesce(adjournment_reason::text, '') AS adjournment_reason,
             coalesce(next_date::text, '') AS next_date
      FROM hearings WHERE id = ${id} AND case_id = ${caseId}`;
    return r ?? null;
  }
  const [r] = await sql<Record<string, string>[]>`
    SELECT order_date::text, order_type::text, order_text,
           coalesce(judge_id::text, '') AS judge_id, coalesce(hearing_id::text, '') AS hearing_id,
           CASE WHEN is_final THEN 'yes' ELSE '' END AS is_final,
           coalesce(disposal_mode::text, '') AS disposal_mode
    FROM orders WHERE id = ${id} AND case_id = ${caseId}`;
  return r ?? null;
}

// How many other cases a party's person appears in: an edit changes the
// person everywhere.
export async function personSharedWith(caseId: number, partyId: number): Promise<number> {
  const [r] = await readDb()<{ n: number }[]>`
    SELECT count(DISTINCT other.case_id)::int AS n
    FROM case_parties cp
    JOIN case_parties other ON other.person_id = cp.person_id AND other.case_id <> cp.case_id
    WHERE cp.id = ${partyId} AND cp.case_id = ${caseId}`;
  return r?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
type Clean = Record<string, string | null>;

export async function saveRecord(admin: AdminSession, kind: Kind, caseId: number, id: number | null, v: Clean) {
  return writeDbTracked(admin, async (sql) => {
    if (kind === "party") {
      if (id === null) {
        const [p] = await sql<{ id: string }[]>`
          INSERT INTO persons (kind, full_name, relation, relative_name, address, district)
          VALUES (${v.kind}::person_kind, ${v.full_name}, ${v.relation}, ${v.relative_name}, ${v.address}, ${v.district})
          RETURNING id`;
        await sql`
          INSERT INTO case_parties (case_id, person_id, role)
          VALUES (${caseId}, ${p.id}, ${v.role}::party_role)`;
        return true;
      }
      const [cp] = await sql<{ person_id: string }[]>`
        UPDATE case_parties SET role = ${v.role}::party_role
        WHERE id = ${id} AND case_id = ${caseId}
        RETURNING person_id`;
      if (!cp) return false;
      await sql`
        UPDATE persons SET kind = ${v.kind}::person_kind, full_name = ${v.full_name},
               relation = ${v.relation}, relative_name = ${v.relative_name},
               address = ${v.address}, district = ${v.district}
        WHERE id = ${cp.person_id}`;
      return true;
    }

    if (kind === "hearing") {
      if (id === null) {
        await sql`
          INSERT INTO hearings (case_id, hearing_date, outcome, judge_id, purpose, adjournment_reason, next_date)
          VALUES (${caseId}, ${v.hearing_date}::date, ${v.outcome}::hearing_outcome, ${v.judge_id}::bigint,
                  ${v.purpose}, ${v.adjournment_reason}::adjournment_reason, ${v.next_date}::date)`;
        return true;
      }
      const rows = await sql`
        UPDATE hearings SET hearing_date = ${v.hearing_date}::date, outcome = ${v.outcome}::hearing_outcome,
               judge_id = ${v.judge_id}::bigint, purpose = ${v.purpose},
               adjournment_reason = ${v.adjournment_reason}::adjournment_reason, next_date = ${v.next_date}::date
        WHERE id = ${id} AND case_id = ${caseId}`;
      return rows.count > 0;
    }

    if (id === null) {
      await sql`
        INSERT INTO orders (case_id, order_date, order_type, order_text, judge_id, hearing_id, is_final, disposal_mode)
        VALUES (${caseId}, ${v.order_date}::date, ${v.order_type}::order_type, ${v.order_text},
                ${v.judge_id}::bigint, ${v.hearing_id}::bigint, ${v.is_final === "yes"},
                ${v.disposal_mode}::disposal_mode)`;
      return true;
    }
    // is_final and disposal_mode are not editable: the disposal they caused
    // is a fact about the case, changed on the case itself.
    const rows = await sql`
      UPDATE orders SET order_date = ${v.order_date}::date, order_type = ${v.order_type}::order_type,
             order_text = ${v.order_text}, judge_id = ${v.judge_id}::bigint, hearing_id = ${v.hearing_id}::bigint
      WHERE id = ${id} AND case_id = ${caseId}`;
    return rows.count > 0;
  });
}

// What depends on a record, as "n things" phrases; empty means it can go.
// A party's advocate links are not blockers: they are removed with it.
export async function dependentsOf(kind: Kind, caseId: number, id: number): Promise<string[]> {
  if (kind !== "hearing") return [];
  const [r] = await readDb()<{ orders: number; witnesses: number }[]>`
    SELECT (SELECT count(*)::int FROM orders    WHERE hearing_id = ${id}) AS orders,
           (SELECT count(*)::int FROM witnesses WHERE hearing_id = ${id}) AS witnesses
    FROM hearings WHERE id = ${id} AND case_id = ${caseId}`;
  return r ? countPhrases({ order: r.orders, witness: r.witnesses }) : [];
}

export async function removeRecord(admin: AdminSession, kind: Kind, caseId: number, id: number) {
  return writeDbTracked(admin, async (sql) => {
    if (kind === "party") {
      await sql`
        DELETE FROM case_advocates
        WHERE case_party_id = (SELECT id FROM case_parties WHERE id = ${id} AND case_id = ${caseId})`;
      return (await sql`DELETE FROM case_parties WHERE id = ${id} AND case_id = ${caseId}`).count > 0;
    }
    if (kind === "hearing") return (await sql`DELETE FROM hearings WHERE id = ${id} AND case_id = ${caseId}`).count > 0;
    return (await sql`DELETE FROM orders WHERE id = ${id} AND case_id = ${caseId}`).count > 0;
  });
}

// ---------------------------------------------------------------------------
// Constraint and trigger names -> form messages
// ---------------------------------------------------------------------------
export const ERRORS: Record<Kind, ErrorMap> = {
  party: {
    case_parties_case_id_person_id_role_key: { field: "role", message: "This person already has this role in the case." },
    persons_check: { field: "relative_name", message: "Give both a relation and the relative's name, or neither." },
    persons_check1: { field: "relation", message: "Only an individual can have a relation." },
  },
  hearing: {
    hearings_one_per_case_per_day: { field: "hearing_date", message: "This case already has a hearing on that date." },
    hearings_next_date_after_hearing_date: { field: "next_date", message: "The next date must be after the hearing date." },
    hearings_reason_only_when_adjourned: { field: "adjournment_reason", message: "Give a reason only when the hearing was adjourned." },
    hearings_not_after_disposal: { field: "hearing_date", message: "The case was already disposed of before this date (trigger hearings_not_after_disposal)." },
  },
  order: {
    orders_disposal_mode_only_when_final: { field: "disposal_mode", message: "Only a final order has a disposal mode." },
    orders_dispose_case: { field: "disposal_mode", message: "A final order of this type needs a disposal mode (trigger orders_dispose_case)." },
    cases_disposal_mode_matches_status: { field: "disposal_mode", message: "This disposal mode does not fit the case." },
    cases_disposed_on_after_filed_on: { field: "order_date", message: "A final order cannot be dated before the case was filed." },
  },
};

export const LABEL: Record<Kind, string> = { party: "party", hearing: "hearing", order: "order" };

export function countPhrases(counts: Record<string, number>): string[] {
  const plural: Record<string, string> = { party: "parties", witness: "witnesses" };
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${n === 1 ? k.replace(/_/g, " ") : (plural[k] ?? `${k}s`).replace(/_/g, " ")}`);
}
