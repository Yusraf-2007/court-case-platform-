// benchmark.ts
// Times five queries with and without the indexes their plans use.
//
// For each query:
//   1. EXPLAIN (FORMAT JSON) with every index in place, to find the indexes
//      the planner actually uses ("its indexes").
//   2. In one transaction: drop those indexes, run EXPLAIN ANALYZE five
//      times, recreate them, run EXPLAIN ANALYZE five times, then ROLLBACK.
//      The ROLLBACK guarantees the schema is left exactly as it was, even if
//      a step fails.
//   3. Report the median Execution Time of each set of five.
//
// Primary-key indexes are never dropped (foreign keys depend on them); they
// are listed as "kept". An index that backs a UNIQUE constraint is dropped
// by dropping the constraint and re-added with its original definition.
//
// --scale N clones the whole case dataset N times (cases, hearings, orders,
// relationships) before benchmarking, because at the real size (57 cases,
// 527 hearings) Postgres scans every table in full whether or not an index
// exists. Clones get case numbers offset by multiples of 10000. Triggers are
// disabled during the clone. Cloned data is committed, so only ever run this
// against a throwaway branch: the script refuses the production endpoint.
//
// Usage:
//   DATABASE_URL=postgres://... npm run benchmark -- [--scale N]
//
// Output: a markdown table on stdout, and every raw EXPLAIN ANALYZE plan in
// db/tests/explain_output.txt.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const PRODUCTION_ENDPOINT = "ep-icy-moon-b5dd1xbl"; // never benchmark here
const RUNS = 5;

const here = dirname(fileURLToPath(import.meta.url));
const queriesDir = join(here, "..", "queries");
const outputFile = join(here, "explain_output.txt");

// Named psql variables (:name, :'name') or positional parameters ($1, $2...).
type Value = string | number | null;
type Params = Record<string, Value> | Value[];
type Bench = { name: string; file: string; params: Params };
type Droppable = {
  index: string;
  drop: string;
  restore: string;
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function parseScale(argv: string[]): number {
  const i = argv.indexOf("--scale");
  if (i === -1) return 1;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) throw new Error("--scale needs a positive integer");
  return n;
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL to a branch connection string.");
if (url.includes(PRODUCTION_ENDPOINT)) {
  throw new Error("Refusing to benchmark production: this script drops indexes and can clone data.");
}
const scale = parseScale(process.argv.slice(2));

function literal(value: Value): string {
  if (value === null) return "NULL";
  return typeof value === "number" ? String(value) : `'${value.replace(/'/g, "''")}'`;
}

// Inline the parameters as literals so EXPLAIN can run the query as text.
// Positional: $1, $2... (highest first, so $1 never matches inside $10).
// Named: psql variables :name and :'name'; only the given names are touched,
// so casts like ::text are left alone.
function bind(sql: string, params: Params): string {
  let out = sql;
  if (Array.isArray(params)) {
    for (let i = params.length; i >= 1; i--) {
      out = out.replace(new RegExp(`\\$${i}(?!\\d)`, "g"), literal(params[i - 1]));
    }
    return out.trim().replace(/;\s*$/, "");
  }
  for (const [name, value] of Object.entries(params)) {
    const quoted = `'${String(value).replace(/'/g, "''")}'`;
    out = out.replaceAll(`:'${name}'`, quoted);
    out = out.replace(new RegExp(`(?<!:):${name}\\b`, "g"), String(value));
  }
  return out.trim().replace(/;\s*$/, "");
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Cloning (--scale)
// ---------------------------------------------------------------------------
async function cloneDataset(db: pg.Client, copies: number): Promise<void> {
  await db.query("BEGIN");
  for (const t of ["cases", "hearings", "orders", "case_relationships"]) {
    await db.query(`ALTER TABLE ${t} DISABLE TRIGGER USER`);
  }
  await db.query(
    `INSERT INTO cases (case_type_id, case_number, case_year, court_id, fir_id, filed_on,
                        registered_on, stage, status, disposal_mode, disposed_on)
     SELECT c.case_type_id, c.case_number + k * 10000, c.case_year, c.court_id, c.fir_id,
            c.filed_on, c.registered_on, c.stage, c.status, c.disposal_mode, c.disposed_on
     FROM cases c CROSS JOIN generate_series(1, $1::int) AS k
     WHERE c.case_number < 10000`,
    [copies],
  );
  await db.query(
    `CREATE TEMP TABLE case_map ON COMMIT DROP AS
     SELECT o.id AS old_id, n.id AS new_id, n.case_number / 10000 AS k
     FROM cases o
     JOIN cases n ON n.case_type_id = o.case_type_id
                 AND n.case_year = o.case_year
                 AND n.case_number >= 10000
                 AND n.case_number % 10000 = o.case_number
     WHERE o.case_number < 10000`,
  );
  await db.query(
    `INSERT INTO hearings (case_id, judge_id, hearing_date, purpose, outcome, next_date,
                           adjournment_reason, is_synthetic)
     SELECT m.new_id, h.judge_id, h.hearing_date, h.purpose, h.outcome, h.next_date,
            h.adjournment_reason, h.is_synthetic
     FROM hearings h JOIN case_map m ON m.old_id = h.case_id`,
  );
  await db.query(
    `INSERT INTO orders (case_id, judge_id, order_date, order_type, order_text, is_final, disposal_mode)
     SELECT m.new_id, o.judge_id, o.order_date, o.order_type, o.order_text, o.is_final, o.disposal_mode
     FROM orders o JOIN case_map m ON m.old_id = o.case_id`,
  );
  await db.query(
    `INSERT INTO case_relationships (from_case_id, to_case_id, rel_type)
     SELECT mf.new_id, mt.new_id, r.rel_type
     FROM case_relationships r
     JOIN case_map mf ON mf.old_id = r.from_case_id
     JOIN case_map mt ON mt.old_id = r.to_case_id AND mt.k = mf.k`,
  );
  for (const t of ["cases", "hearings", "orders", "case_relationships"]) {
    await db.query(`ALTER TABLE ${t} ENABLE TRIGGER USER`);
  }
  await db.query("COMMIT");
  await db.query("ANALYZE");
}

// ---------------------------------------------------------------------------
// Index discovery
// ---------------------------------------------------------------------------
function indexNames(plan: unknown, found = new Set<string>()): Set<string> {
  if (plan && typeof plan === "object") {
    const node = plan as Record<string, unknown>;
    if (typeof node["Index Name"] === "string") found.add(node["Index Name"]);
    for (const v of Object.values(node)) indexNames(v, found);
  }
  return found;
}

async function droppables(db: pg.Client, names: string[]): Promise<{ drop: Droppable[]; kept: string[] }> {
  const drop: Droppable[] = [];
  const kept: string[] = [];
  for (const name of names) {
    const { rows } = await db.query(
      `SELECT i.indexrelid::regclass::text AS index,
              i.indrelid::regclass::text   AS tbl,
              pg_get_indexdef(i.indexrelid) AS indexdef,
              con.conname, con.contype,
              pg_get_constraintdef(con.oid) AS condef
       FROM pg_index i
       -- Only the constraint the index itself implements. (Foreign keys in
       -- other tables also point at a primary key through conindid.)
       LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid
                                  AND con.conrelid = i.indrelid
                                  AND con.contype IN ('p', 'u', 'x')
       WHERE i.indexrelid = $1::regclass`,
      [name],
    );
    const r = rows[0];
    if (r.contype === "p") {
      kept.push(`${name} (primary key)`);
    } else if (r.conname) {
      drop.push({
        index: name,
        drop: `ALTER TABLE ${r.tbl} DROP CONSTRAINT ${r.conname}`,
        restore: `ALTER TABLE ${r.tbl} ADD CONSTRAINT ${r.conname} ${r.condef}`,
      });
    } else {
      drop.push({ index: name, drop: `DROP INDEX ${name}`, restore: r.indexdef });
    }
  }
  return { drop, kept };
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
async function explainRuns(db: pg.Client, sql: string, label: string, log: string[]) {
  const times: number[] = [];
  let rows = 0;
  for (let run = 1; run <= RUNS; run++) {
    const res = await db.query<{ "QUERY PLAN": string }>(`EXPLAIN ANALYZE ${sql}`);
    const lines = res.rows.map((r) => r["QUERY PLAN"]);
    log.push(`--- ${label}, run ${run} ---`, ...lines, "");
    const exec = lines.find((l) => l.startsWith("Execution Time:"));
    times.push(Number(exec?.match(/([\d.]+) ms/)?.[1]));
    rows = Number(lines[0].match(/actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/)?.[1] ?? 0);
  }
  return { median: median(times), times, rows };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const db = new pg.Client({ connectionString: url });
await db.connect();

if (scale > 1) {
  process.stderr.write(`Cloning the dataset ${scale} times...\n`);
  await cloneDataset(db, scale);
}

const ids = await db.query(
  `SELECT (SELECT c.id FROM cases c JOIN case_types ct ON ct.id = c.case_type_id
           WHERE (ct.code, c.case_number, c.case_year) = ('GR', 412, 2024)) AS case_1,
          (SELECT id FROM courts WHERE name = 'JMFC Court No. 3, Begusarai') AS court_3`,
);
const { case_1, court_3 } = ids.rows[0];

const benches: Bench[] = [
  { name: "case list (court, stage, status)", file: "case_list.sql",
    // court, case type, stage, status, page size (NULL = all), offset
    params: [court_3, null, "prosecution_evidence", "pending", null, 0] },
  { name: "case_family (Case 1)", file: "case_family.sql", params: { case_id: case_1 } },
  { name: "case_timeline (Case 1)", file: "case_timeline.sql", params: [case_1] },
  { name: "adjournment_analysis", file: "adjournment_analysis.sql", params: {} },
  { name: "cause list (court, date)", file: "cause_list.sql",
    params: { court_id: court_3, hearing_date: "2024-10-31" } },
];

const counts = await db.query(
  `SELECT (SELECT count(*) FROM cases) AS cases, (SELECT count(*) FROM hearings) AS hearings,
          (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM case_relationships) AS edges`,
);
const log: string[] = [
  `Benchmark, scale ${scale}: ${JSON.stringify(counts.rows[0])}`,
  `Each query: EXPLAIN ANALYZE x${RUNS} without its indexes, then x${RUNS} with them.`,
  "",
];
const results: string[] = [];

for (const b of benches) {
  const sql = bind(readFileSync(join(queriesDir, b.file), "utf8"), b.params);

  const planned = await db.query(`EXPLAIN (FORMAT JSON) ${sql}`);
  const used = [...indexNames(planned.rows[0]["QUERY PLAN"])];
  const { drop, kept } = await droppables(db, used);

  log.push(`=================== ${b.name} ===================`,
           `indexes used: ${used.join(", ") || "none"}`,
           `dropped: ${drop.map((d) => d.index).join(", ") || "none"}`,
           `kept: ${kept.join(", ") || "none"}`, "");

  await db.query("BEGIN");
  try {
    for (const d of drop) await db.query(d.drop);
    const without = await explainRuns(db, sql, `${b.name}: WITHOUT indexes`, log);
    for (const d of drop) await db.query(d.restore);
    const withIdx = await explainRuns(db, sql, `${b.name}: WITH indexes`, log);

    const speedup = drop.length ? `${(without.median / withIdx.median).toFixed(1)}x` : "n/a (no droppable index)";
    results.push(`| ${b.name} | ${withIdx.rows} | ${without.median.toFixed(3)} ms | ${withIdx.median.toFixed(3)} ms | ${speedup} | ${drop.map((d) => d.index).join(", ") || "-"} |`);
  } finally {
    await db.query("ROLLBACK"); // schema back exactly as it was
  }
}

await db.end();
writeFileSync(outputFile, log.join("\n") + "\n");

console.log(`Scale ${scale}: ${counts.rows[0].cases} cases, ${counts.rows[0].hearings} hearings, ` +
            `${counts.rows[0].orders} orders, ${counts.rows[0].edges} relationships. ` +
            `Median of ${RUNS} EXPLAIN ANALYZE Execution Times.\n`);
console.log("| query | rows | without index | with index | speedup | indexes dropped |");
console.log("|---|---|---|---|---|---|");
for (const r of results) console.log(r);
