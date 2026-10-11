// search_eval.ts
// Scores the order search three ways on a fixed question set: full-text
// alone, semantic alone, and the hybrid that /search shows. Uses the same
// SQL files and the same fusion (src/lib/rrf.ts) as the page, so it measures
// what users get.
//
//   DATABASE_URL=... npx tsx db/tests/search_eval.ts [--set db/tests/search_eval.json] [--verbose] [--out results.json]
//
// DATABASE_URL is the read-only login (app_web, 014): the harness only reads.
// Semantic and hybrid also need EMBEDDING_API_URL / EMBEDDING_API_KEY /
// EMBEDDING_MODEL (as for db/scripts/embed_orders.ts) and orders embedded by
// that model; until then they are reported as unavailable, not as zero.
//
// Question set (JSON):
//   {
//     "questions": [
//       {
//         "id": "q01",
//         "query": "accused granted bail on a bond",
//         "relevant": [
//           { "case": "GR 412/2024", "type": "bail" },          // by case and order type
//           { "case": "NI 201/2024", "date": "2024-06-06" },    // by case and order date
//           { "case": "CC 55/2023" }                            // every order of the case
//         ],
//         "note": "optional: why these are the right answers"
//       }
//     ]
//   }
// Orders are named by case number, date and type rather than by id, so a
// set written against production also scores a local copy. Every reference
// must match at least one order, or the run stops: a typo must not quietly
// score as a miss.
//
// Metrics, averaged over questions:
//   P@k   relevant orders in the top k, divided by k
//   MRR   1 / rank of the first relevant order (0 if none in the top 50)
// P@k cannot exceed |relevant| / k: a question with one right answer scores
// at most 0.1 at P@10. The "ceiling" row is the best any ranking could do on
// this set, so the method rows can be read against it.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

import { embedTexts, embeddingModel, embeddingsConfigured, toVectorLiteral } from "../../src/lib/embed-api";
import { fuse, type Ranked } from "../../src/lib/rrf";

const KS = [1, 5, 10] as const;
const DEPTH = 50; // candidates per method, as on the page

type OrderRef = { case: string; date?: string; type?: string };
type Question = { id: string; query: string; relevant: OrderRef[]; note?: string };
type Method = "full-text" | "semantic" | "hybrid";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const setPath = arg("set") ?? "db/tests/search_eval.json";
const outPath = arg("out");
const verbose = process.argv.includes("--verbose");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is not set (use the read-only app_web login).");

let questions: Question[];
try {
  questions = (JSON.parse(readFileSync(setPath, "utf8")) as { questions: Question[] }).questions;
} catch (e) {
  console.error(`Cannot read the question set at ${setPath}: ${(e as Error).message}`);
  console.error("Write it in the format at the top of this file (db/tests/search_eval.example.json is a small example).");
  process.exit(2);
}
if (!Array.isArray(questions) || questions.length === 0) throw new Error(`${setPath} has no questions.`);
const ids = new Set<string>();
for (const q of questions) {
  if (!q.id || !q.query?.trim() || !Array.isArray(q.relevant) || q.relevant.length === 0)
    throw new Error(`Question ${JSON.stringify(q.id ?? q.query)} needs an id, a query and at least one relevant order.`);
  if (ids.has(q.id)) throw new Error(`Duplicate question id ${q.id}.`);
  ids.add(q.id);
}

const sql = postgres(dbUrl, { prepare: false, max: 2 });
const queryFile = (name: string) => readFileSync(join(process.cwd(), "db/queries", `${name}.sql`), "utf8");
const FTS_SQL = queryFile("search_orders_fts");
const VECTOR_SQL = queryFile("search_orders_vector");

// "GR 412/2024" (+ optional date and type) -> order ids. Archived cases are
// out of the search, so they are out of the answers too.
async function resolve(ref: OrderRef): Promise<string[]> {
  const m = /^([A-Z]+)\s+(\d+)\/(\d{4})$/.exec(ref.case?.trim() ?? "");
  if (!m) throw new Error(`Case reference ${JSON.stringify(ref.case)} is not like "GR 412/2024".`);
  const rows = await sql<{ id: string }[]>`
    SELECT o.id
    FROM orders o
    JOIN cases c       ON c.id = o.case_id AND c.deleted_at IS NULL
    JOIN case_types ct ON ct.id = c.case_type_id
    WHERE ct.code = ${m[1]} AND c.case_number = ${Number(m[2])} AND c.case_year = ${Number(m[3])}
      AND (${ref.date ?? null}::date IS NULL OR o.order_date = ${ref.date ?? null}::date)
      AND (${ref.type ?? null}::text IS NULL OR o.order_type::text = ${ref.type ?? null}::text)
    ORDER BY o.id`;
  return rows.map((r) => r.id);
}

const precisionAt = (ranked: string[], relevant: Set<string>, k: number) =>
  ranked.slice(0, k).filter((id) => relevant.has(id)).length / k;
const reciprocalRank = (ranked: string[], relevant: Set<string>) => {
  const i = ranked.findIndex((id) => relevant.has(id));
  return i < 0 ? 0 : 1 / (i + 1);
};

try {
  // Is the semantic half usable, and over how much of the table?
  const model = embeddingModel();
  const [{ embedded, total }] = await sql<{ embedded: number; total: number }[]>`
    SELECT count(*) FILTER (WHERE embedding_model = ${model})::int AS embedded, count(*)::int AS total FROM orders`;
  const semanticReason = !embeddingsConfigured()
    ? "no embedding API configured (EMBEDDING_API_URL, EMBEDDING_API_KEY)"
    : embedded === 0
      ? `no orders embedded with ${model} yet (run db/scripts/embed_orders.ts)`
      : null;

  // Resolve every judgment before searching, so a bad reference stops the run.
  const relevantOf = new Map<string, Set<string>>();
  for (const q of questions) {
    const found = new Set<string>();
    for (const ref of q.relevant) {
      const hits = await resolve(ref);
      if (hits.length === 0) throw new Error(`${q.id}: no order matches ${JSON.stringify(ref)}.`);
      hits.forEach((h) => found.add(h));
    }
    relevantOf.set(q.id, found);
  }

  // Query embeddings, one batch for the whole set.
  let queryVectors: number[][] | null = null;
  let semanticError: string | null = null;
  if (!semanticReason) {
    try {
      queryVectors = await embedTexts(questions.map((q) => q.query));
    } catch (e) {
      semanticError = `embedding the questions failed: ${(e as Error).message}`;
    }
  }
  const semanticUnavailable = semanticReason ?? semanticError;

  type Row = { id: string; query: string; relevant: number; ranked: Record<Method, string[] | null> };
  const rows: Row[] = [];
  for (const [i, q] of questions.entries()) {
    const fts = (await sql.unsafe<{ id: string; rank: string }[]>(FTS_SQL, [q.query, DEPTH])).map((r) => ({ id: r.id, rank: Number(r.rank) }));
    let vec: Ranked[] | null = null;
    if (queryVectors) {
      vec = (await sql.unsafe<{ id: string; rank: string }[]>(VECTOR_SQL, [toVectorLiteral(queryVectors[i]), model, DEPTH])).map((r) => ({
        id: r.id,
        rank: Number(r.rank),
      }));
    }
    rows.push({
      id: q.id,
      query: q.query,
      relevant: relevantOf.get(q.id)!.size,
      ranked: {
        "full-text": fts.map((r) => r.id),
        semantic: vec ? vec.map((r) => r.id) : null,
        hybrid: vec ? fuse([fts, vec]).map((r) => r.id) : null,
      },
    });
  }

  // Score.
  const methods: Method[] = ["full-text", "semantic", "hybrid"];
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const summary: Record<string, Record<string, number> | null> = {};
  for (const m of methods) {
    if (rows[0].ranked[m] === null) {
      summary[m] = null;
      continue;
    }
    const s: Record<string, number> = {};
    for (const k of KS) s[`P@${k}`] = mean(rows.map((r) => precisionAt(r.ranked[m]!, relevantOf.get(r.id)!, k)));
    s.MRR = mean(rows.map((r) => reciprocalRank(r.ranked[m]!, relevantOf.get(r.id)!)));
    summary[m] = s;
  }
  const ceiling: Record<string, number> = {};
  for (const k of KS) ceiling[`P@${k}`] = mean(rows.map((r) => Math.min(r.relevant, k) / k));
  ceiling.MRR = 1;

  // Report.
  const f = (x: number) => x.toFixed(3);
  console.log(`Search evaluation: ${questions.length} questions from ${setPath}${questions.length !== 30 ? ` (note: the planned set has 30)` : ""}`);
  console.log(`Orders: ${total}; embedded with ${model}: ${embedded}${embedded > 0 && embedded < total ? "  (partial: semantic results cover only the embedded orders)" : ""}`);
  console.log("");
  console.log(["method".padEnd(10), ...KS.map((k) => `P@${k}`.padStart(7)), "MRR".padStart(7)].join(" "));
  for (const m of methods) {
    const s = summary[m];
    console.log(
      s
        ? [m.padEnd(10), ...KS.map((k) => f(s[`P@${k}`]).padStart(7)), f(s.MRR).padStart(7)].join(" ")
        : `${m.padEnd(10)} unavailable: ${semanticUnavailable}`,
    );
  }
  console.log([("ceiling").padEnd(10), ...KS.map((k) => f(ceiling[`P@${k}`]).padStart(7)), f(1).padStart(7)].join(" "));

  if (verbose) {
    console.log("\nPer question (P@1 / P@5 / P@10):");
    for (const r of rows) {
      const cells = methods.map((m) =>
        r.ranked[m] ? `${m} ${KS.map((k) => f(precisionAt(r.ranked[m]!, relevantOf.get(r.id)!, k))).join("/")}` : `${m} -`,
      );
      console.log(`  ${r.id.padEnd(5)} [${r.relevant} relevant] ${cells.join("  ")}  "${r.query}"`);
    }
  }

  if (outPath) {
    writeFileSync(
      outPath,
      JSON.stringify({ set: setPath, model, orders: total, embedded, semanticUnavailable, summary, ceiling, questions: rows }, null, 2),
    );
    console.log(`\nWrote ${outPath}.`);
  }
} finally {
  await sql.end();
}
