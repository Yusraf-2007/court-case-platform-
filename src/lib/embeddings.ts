import "server-only";

import { embedTexts } from "@/lib/embed-api";

export { embeddingModel, embeddingsConfigured } from "@/lib/embed-api";

// Query embeddings for the semantic half of /search, through the same API
// and model as db/scripts/embed_orders.ts (see lib/embed-api.ts). When the
// API is not configured, or the call fails, the page shows the full-text
// half alone and says so.

// A small per-process cache: repeated searches do not call the API again.
const cache = new Map<string, number[]>();

export async function embedQuery(text: string): Promise<number[]> {
  const key = `${process.env.EMBEDDING_MODEL ?? ""}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [v] = await embedTexts([text], 8000);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, v);
  return v;
}
