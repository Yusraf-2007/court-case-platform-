import "server-only";
import { cache } from "react";

import { readDb as db } from "@/lib/db-read";
import { runQuery } from "@/lib/queries";

export const PAGE_SIZE = 20;

export type CaseFilters = {
  courtId: number | null;
  caseTypeId: number | null;
  stage: string | null;
  status: string | null;
  page: number;
  // Archived cases: public pages always use "live". Only parseFilters with
  // { admin: true } reads another value from the URL.
  archived: "live" | "all" | "archived";
};

export type CaseRow = {
  id: number;
  case_no: string;
  case_type: string;
  court: string;
  stage: string | null;
  status: string;
  filed_on: Date | null;
  deleted_at: Date | null;
};

export type FilterOptions = {
  courts: { id: number; name: string }[];
  caseTypes: { id: number; code: string; name: string }[];
  stages: string[];
  statuses: string[];
};

// Filter choices come from the database, so new courts, case types or enum
// values appear without a code change. cache() dedupes within one request.
export const getFilterOptions = cache(async (): Promise<FilterOptions> => {
  const sql = db();
  const [courts, caseTypes, stages, statuses] = await Promise.all([
    sql<{ id: number; name: string }[]>`
      SELECT id::int, name FROM courts ORDER BY hierarchy_level, name`,
    sql<{ id: number; code: string; name: string }[]>`
      SELECT id::int, code, name FROM case_types ORDER BY min_court_level, code`,
    sql<{ v: string }[]>`SELECT unnest(enum_range(NULL::case_stage))::text AS v`,
    sql<{ v: string }[]>`SELECT unnest(enum_range(NULL::case_status))::text AS v`,
  ]);
  return {
    courts: [...courts],
    caseTypes: [...caseTypes],
    stages: stages.map((r) => r.v),
    statuses: statuses.map((r) => r.v),
  };
});

type CaseListRow = CaseRow & { total_count: string };

function runCaseList(f: CaseFilters, limit: number, offset: number) {
  return runQuery<CaseListRow>("case_list", [
    f.courtId,
    f.caseTypeId,
    f.stage,
    f.status,
    limit,
    offset,
    f.archived,
  ]);
}

export async function listCases(f: CaseFilters): Promise<{ rows: CaseRow[]; total: number }> {
  const rows = await runCaseList(f, PAGE_SIZE, (f.page - 1) * PAGE_SIZE);
  // A page past the end returns no rows, and so no total_count. Fetch the
  // total separately so the page can send the reader to the last page.
  if (rows.length === 0 && f.page > 1) {
    const [first] = await runCaseList(f, 1, 0);
    return { rows: [], total: first ? Number(first.total_count) : 0 };
  }
  return {
    rows: rows.map((r) => ({
      id: Number(r.id),
      case_no: r.case_no,
      case_type: r.case_type,
      court: r.court,
      stage: r.stage,
      status: r.status,
      filed_on: r.filed_on,
      deleted_at: r.deleted_at,
    })),
    total: rows.length ? Number(rows[0].total_count) : 0,
  };
}

// Turn untrusted search params into filters. Anything that is not a known
// court, case type, stage or status is dropped rather than passed through.
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
  options: FilterOptions,
  { admin = false }: { admin?: boolean } = {},
): CaseFilters {
  const one = (k: string) => {
    const v = params[k];
    return typeof v === "string" && v !== "" ? v : null;
  };
  const id = (k: string, allowed: number[]) => {
    const v = one(k);
    if (v === null || !/^\d+$/.test(v)) return null;
    const n = Number(v);
    return allowed.includes(n) ? n : null;
  };
  const member = (k: string, allowed: string[]) => {
    const v = one(k);
    return v !== null && allowed.includes(v) ? v : null;
  };
  const page = Number(one("page"));

  return {
    courtId: id("court", options.courts.map((c) => c.id)),
    caseTypeId: id("type", options.caseTypes.map((t) => t.id)),
    stage: member("stage", options.stages),
    status: member("status", options.statuses),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    archived: admin ? ((member("archived", ["all", "archived"]) as "all" | "archived" | null) ?? "live") : "live",
  };
}
