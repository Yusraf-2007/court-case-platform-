// One call to an OpenAI-compatible embeddings API. No framework imports, so
// both the app (lib/embeddings.ts) and the scripts can use it. Configured by
// EMBEDDING_API_URL, EMBEDDING_API_KEY and EMBEDDING_MODEL.

export const EMBEDDING_DIMENSIONS = 1536;
export const embeddingModel = () => process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
export const embeddingsConfigured = () => Boolean(process.env.EMBEDDING_API_URL && process.env.EMBEDDING_API_KEY);

export async function embedTexts(texts: string[], timeoutMs = 60_000): Promise<number[][]> {
  const base = process.env.EMBEDDING_API_URL!.replace(/\/+$/, "");
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: embeddingModel(), input: texts }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = new Error(`embedding API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  const vectors = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (vectors.length !== texts.length) throw new Error(`asked for ${texts.length} embeddings, got ${vectors.length}`);
  const bad = vectors.find((v) => v.length !== EMBEDDING_DIMENSIONS);
  if (bad) throw new Error(`${embeddingModel()} returned ${bad.length} dimensions; orders.embedding is vector(${EMBEDDING_DIMENSIONS}).`);
  return vectors;
}

// pgvector's text input format, sent as a bound parameter and cast ::vector.
export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;
