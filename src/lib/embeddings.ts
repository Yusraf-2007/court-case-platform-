import "server-only";

// Query embeddings for the semantic half of /search. Configured by the same
// variables as db/scripts/embed_orders.ts, so queries and orders are
// embedded by the same model:
//   EMBEDDING_API_URL  OpenAI-compatible base URL (".../v1")
//   EMBEDDING_API_KEY  bearer token
//   EMBEDDING_MODEL    default text-embedding-3-small (1536 dimensions)
// When they are not set, or the call fails, semantic search is reported as
// unavailable and the page shows the full-text half alone.

export const embeddingModel = () => process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
export const embeddingsConfigured = () => Boolean(process.env.EMBEDDING_API_URL && process.env.EMBEDDING_API_KEY);

// A small per-process cache: repeated searches do not call the API again.
const cache = new Map<string, number[]>();

export async function embedQuery(text: string): Promise<number[]> {
  const key = `${embeddingModel()}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const base = process.env.EMBEDDING_API_URL!.replace(/\/+$/, "");
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: embeddingModel(), input: text }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`embedding API returned HTTP ${res.status}`);
  const body = (await res.json()) as { data: { embedding: number[] }[] };
  const v = body.data?.[0]?.embedding;
  if (!Array.isArray(v) || v.length !== 1536) throw new Error(`expected 1536 dimensions, got ${v?.length}`);

  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, v);
  return v;
}
