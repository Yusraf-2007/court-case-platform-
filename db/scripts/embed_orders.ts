// embed_orders.ts
// Backfill orders.embedding (migration 020) from order_text.
//
//   ADMIN_DATABASE_URL=...  EMBEDDING_API_URL=...  EMBEDDING_API_KEY=... \
//     npx tsx db/scripts/embed_orders.ts --limit 20
//
// Options:
//   --limit N    embed at most N orders this run (default: all missing)
//   --batch N    orders per API request and per transaction (default 10)
//   --dry-run    read and report, call nothing, write nothing
//
// Environment:
//   ADMIN_DATABASE_URL  write login (app_admin_user, 017); UPDATE on orders
//   EMBEDDING_API_URL   an OpenAI-compatible base URL, e.g.
//                       https://api.openai.com/v1, or the Neon AI Gateway's
//                       ${NEON_AI_GATEWAY_BASE_URL}/v1 if its catalog serves
//                       a 1536-dimension embedding model
//   EMBEDDING_API_KEY   bearer token for that API
//   EMBEDDING_MODEL     default text-embedding-3-small (1536 dimensions)
//
// Only orders with no embedding are picked up, so the script is safe to
// re-run: after a failure, after an edit (020's trigger clears a stale
// embedding), or to finish a partial run. Each batch is one API call with
// retries (exponential backoff on 429, 5xx and network errors), then one
// transaction. A row is written only if its text is unchanged since it was
// read, so an order edited mid-run keeps its NULL and is picked up next time.
// The audit trigger omits these columns (020), so a backfill adds no audit rows.

import postgres from "postgres";

import { embedTexts, embeddingModel, toVectorLiteral } from "../../src/lib/embed-api";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const dryRun = process.argv.includes("--dry-run");
const limit = arg("limit") ? Number(arg("limit")) : null;
const batchSize = Number(arg("batch") ?? 10);
if ((limit !== null && !(Number.isInteger(limit) && limit > 0)) || !(Number.isInteger(batchSize) && batchSize > 0 && batchSize <= 100)) {
  console.error("--limit must be a positive integer; --batch between 1 and 100.");
  process.exit(2);
}

const dbUrl = process.env.ADMIN_DATABASE_URL;
const apiUrl = process.env.EMBEDDING_API_URL?.replace(/\/+$/, "");
const apiKey = process.env.EMBEDDING_API_KEY;
const model = embeddingModel();
if (!dbUrl) throw new Error("ADMIN_DATABASE_URL is not set.");
if (!dryRun && (!apiUrl || !apiKey)) throw new Error("EMBEDDING_API_URL and EMBEDDING_API_KEY must be set (or pass --dry-run).");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One embeddings request, retried with exponential backoff on 429, 5xx and
// network errors. A wrong dimension count or another 4xx fails at once.
async function embed(texts: string[], attempts = 5): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embedTexts(texts);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      const retryable = status === undefined ? !/dimensions/.test((e as Error).message) : status === 429 || status >= 500;
      if (!retryable || attempt >= attempts) throw e;
      const wait = Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
      console.warn(`  attempt ${attempt} failed (${(e as Error).message}); retrying in ${wait} ms`);
      await sleep(wait);
    }
  }
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });

try {
  const [{ total, missing }] = await sql<{ total: number; missing: number }[]>`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE embedding IS NULL)::int AS missing FROM orders`;
  const todo = await sql<{ id: string; order_text: string }[]>`
    SELECT id, order_text FROM orders
    WHERE embedding IS NULL
    ORDER BY id
    ${limit !== null ? sql`LIMIT ${limit}` : sql``}`;
  console.log(`${total} orders, ${missing} without an embedding; this run: ${todo.length} (${model}, batches of ${batchSize})${dryRun ? ", dry run" : ""}.`);

  let written = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const label = `batch ${i / batchSize + 1}: orders ${batch[0].id}-${batch[batch.length - 1].id}`;
    if (dryRun) {
      console.log(`  ${label} (${batch.length}) would be embedded`);
      continue;
    }
    let vectors: number[][];
    try {
      vectors = await embed(batch.map((o) => o.order_text));
    } catch (e) {
      console.error(`  ${label} FAILED: ${(e as Error).message}`);
      failed.push(...batch.map((o) => o.id));
      continue; // the rest of the run goes on; these stay NULL for the next run
    }
    const n = await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.user', 'embed_orders', true)`;
      let count = 0;
      for (let j = 0; j < batch.length; j++) {
        const rows = await tx`
          UPDATE orders
          SET embedding = ${toVectorLiteral(vectors[j])}::vector, embedding_model = ${model}
          WHERE id = ${batch[j].id} AND embedding IS NULL AND order_text = ${batch[j].order_text}`;
        count += rows.count;
      }
      return count;
    });
    written += n;
    skipped += batch.length - n;
    console.log(`  ${label}: ${n} written${n < batch.length ? `, ${batch.length - n} changed since read (left for the next run)` : ""}`);
  }

  const [after] = await sql<{ embedded: number; missing: number }[]>`
    SELECT count(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded,
           count(*) FILTER (WHERE embedding IS NULL)::int     AS missing
    FROM orders`;
  console.log(`Done: ${written} written, ${skipped} skipped, ${failed.length} failed${failed.length ? ` (ids ${failed.join(", ")})` : ""}.`);
  console.log(`orders now: ${after.embedded} embedded, ${after.missing} without an embedding.`);
  if (failed.length) process.exitCode = 1;
} finally {
  await sql.end();
}
