import "server-only";

import { readDb } from "@/lib/db-read";
import { runQuery } from "@/lib/queries";

export type Tally = { key: string; label: string; pending: number; disposed: number; other: number; total: number };

export type Deadline = {
  case_id: string;
  case_no: string;
  remedy: string;
  trigger_event: string;
  order_date: Date;
  days: number;
  deadline: Date;
  days_left: number;
};

export type Activity = {
  id: string;
  case_id: string;
  case_no: string | null; // null once the case is deleted
  table_name: string;
  action: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: Date;
  changed_by: string | null;
};

// Everything on /admin, read through the read-only connection. Counts are
// of cases not archived, except the archived figure itself.
export async function getDashboard(today = new Date()) {
  const sql = readDb();
  const asOf = today.toISOString().slice(0, 10);
  const [[totals], byCourt, byType, byStatus, [rules], deadlines, activity] = await Promise.all([
    sql<{ live: number; pending: number; disposed: number; archived: number }[]>`
      SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int                         AS live,
             count(*) FILTER (WHERE deleted_at IS NULL AND status = 'pending')::int  AS pending,
             count(*) FILTER (WHERE deleted_at IS NULL AND status = 'disposed')::int AS disposed,
             count(*) FILTER (WHERE deleted_at IS NOT NULL)::int                     AS archived
      FROM cases`,
    sql<Tally[]>`
      SELECT co.id::text AS key, co.name AS label,
             count(*) FILTER (WHERE c.status = 'pending')::int                AS pending,
             count(*) FILTER (WHERE c.status = 'disposed')::int               AS disposed,
             count(*) FILTER (WHERE c.status NOT IN ('pending', 'disposed'))::int AS other,
             count(*)::int                                                    AS total
      FROM cases c JOIN courts co ON co.id = c.court_id
      WHERE c.deleted_at IS NULL
      GROUP BY co.id, co.name, co.hierarchy_level
      ORDER BY total DESC, co.hierarchy_level DESC, co.name`,
    sql<Tally[]>`
      SELECT ct.id::text AS key, ct.code || ': ' || ct.name AS label,
             count(c.id) FILTER (WHERE c.status = 'pending')::int                AS pending,
             count(c.id) FILTER (WHERE c.status = 'disposed')::int               AS disposed,
             count(c.id) FILTER (WHERE c.status NOT IN ('pending', 'disposed'))::int AS other,
             count(c.id)::int                                                    AS total
      FROM case_types ct
      LEFT JOIN cases c ON c.case_type_id = ct.id AND c.deleted_at IS NULL
      GROUP BY ct.id, ct.code, ct.name
      ORDER BY total DESC, ct.code`,
    sql<{ status: string; n: number }[]>`
      SELECT s.status::text, count(c.id)::int AS n
      FROM unnest(enum_range(NULL::case_status)) AS s(status)
      LEFT JOIN cases c ON c.status = s.status AND c.deleted_at IS NULL
      GROUP BY s.status ORDER BY s.status`,
    sql<{ total: number; verified: number }[]>`
      SELECT (SELECT count(*) FROM limitation_rules)::int        AS total,
             (SELECT count(*) FROM usable_limitation_rules)::int AS verified`,
    runQuery<Deadline>("pending_deadlines", [asOf]),
    sql<Activity[]>`
      SELECT l.id, l.case_id, ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
             l.table_name, l.action, l.field_changed, l.old_value, l.new_value, l.changed_at, l.changed_by
      FROM case_audit_log l
      LEFT JOIN cases c       ON c.id = l.case_id
      LEFT JOIN case_types ct ON ct.id = c.case_type_id
      ORDER BY l.id DESC
      LIMIT 12`,
  ]);
  return {
    totals,
    byCourt: [...byCourt],
    byType: [...byType],
    byStatus: [...byStatus],
    rules,
    deadlines: [...deadlines],
    activity: [...activity],
  };
}

// One case's audit history, newest first.
export async function getCaseAudit(caseId: number) {
  const rows = await readDb()<Omit<Activity, "case_no">[]>`
    SELECT id, case_id, table_name, action, field_changed, old_value, new_value, changed_at, changed_by
    FROM case_audit_log WHERE case_id = ${caseId}
    ORDER BY id DESC LIMIT 100`;
  return [...rows];
}
