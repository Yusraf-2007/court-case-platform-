import "server-only";

import { readDb } from "@/lib/db-read";

export type LandingStats = {
  cases: number;
  courts: number;
  states: number;
  disposed: number;
  byLevel: Record<number, number>; // court_levels.level -> courts on record
};

// Live figures for the landing page, read when the page is requested.
export async function getLandingStats(): Promise<LandingStats> {
  const sql = readDb();
  const [[totals], levels] = await Promise.all([
    sql<Omit<LandingStats, "byLevel">[]>`
      SELECT (SELECT count(*) FROM cases)::int                                AS cases,
             (SELECT count(*) FROM courts)::int                               AS courts,
             (SELECT count(DISTINCT state) FROM high_court_jurisdictions)::int AS states,
             (SELECT count(*) FROM cases WHERE status = 'disposed')::int      AS disposed`,
    sql<{ level: number; n: number }[]>`
      SELECT hierarchy_level AS level, count(*)::int AS n FROM courts GROUP BY hierarchy_level`,
  ]);
  return { ...totals, byLevel: Object.fromEntries(levels.map((l) => [l.level, l.n])) };
}
