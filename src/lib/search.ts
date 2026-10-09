import "server-only";

import { readDb } from "@/lib/db-read";

export type SearchHit = {
  id: string;
  case_no: string;
  court: string;
  status: string;
  matched: string | null; // the party name that matched, for name searches
};

// Exact lookup by register, number and year: what a litigant has on paper.
export async function findCaseByNumber(typeCode: string, number: number, year: number): Promise<string | null> {
  const [row] = await readDb()<{ id: string }[]>`
    SELECT c.id
    FROM cases c JOIN case_types ct ON ct.id = c.case_type_id
    WHERE ct.code = ${typeCode} AND c.case_number = ${number} AND c.case_year = ${year}`;
  return row?.id ?? null;
}

// Cases with a party whose name contains the query. LIKE wildcards in the
// query are escaped, so they match literally; the pattern is a bound value.
export async function searchByParty(query: string): Promise<SearchHit[]> {
  const pattern = `%${query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await readDb()<SearchHit[]>`
    SELECT DISTINCT ON (c.id)
           c.id,
           ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
           co.name AS court,
           c.status::text AS status,
           p.full_name AS matched
    FROM persons p
    JOIN case_parties cp ON cp.person_id = p.id
    JOIN cases c         ON c.id = cp.case_id
    JOIN case_types ct   ON ct.id = c.case_type_id
    JOIN courts co       ON co.id = c.court_id
    WHERE p.full_name ILIKE ${pattern}
    ORDER BY c.id
    LIMIT 50`;
  return [...rows];
}

// Cases whose number matches, when the year or register is not known.
export async function searchByNumber(number: number): Promise<SearchHit[]> {
  const rows = await readDb()<SearchHit[]>`
    SELECT c.id,
           ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
           co.name AS court,
           c.status::text AS status,
           NULL AS matched
    FROM cases c
    JOIN case_types ct ON ct.id = c.case_type_id
    JOIN courts co     ON co.id = c.court_id
    WHERE c.case_number = ${number}
    ORDER BY c.case_year DESC, ct.code
    LIMIT 50`;
  return [...rows];
}
