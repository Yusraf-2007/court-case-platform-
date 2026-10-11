import "server-only";

import { readDb } from "@/lib/db-read";
import { embedQuery, embeddingModel, embeddingsConfigured } from "@/lib/embeddings";
import { runQuery } from "@/lib/queries";

// Hybrid search over order text. The two halves run as separate queries
// (db/queries/search_orders_fts.sql and search_orders_vector.sql), each
// returning its own ranked candidates, and are fused here with reciprocal
// rank fusion:
//
//   fused(d) = sum over the methods that found d of 1 / (K + rank(d))
//
// RRF uses ranks, not scores, so a ts_rank_cd value and a cosine similarity
// (different scales, different meanings) never have to be compared. A
// document found by both methods collects two terms, so agreement wins.
// Each result keeps both individual scores and ranks, so the page can show
// what each half contributed.

export const RRF_K = 60; // the constant from Cormack et al. (2009); damps the top ranks
const DEPTH = 50; // candidates taken from each method before fusion
const TOP = 20;

type Hit = { id: string; score: number; rank: string };

export type OrderResult = {
  id: string;
  caseId: string;
  caseNo: string;
  court: string;
  orderDate: Date;
  orderType: string;
  isFinal: boolean;
  textMarked: string; // order text with full-text matches wrapped in « »
  fts: { score: number; rank: number } | null;
  vector: { score: number; rank: number } | null;
  fused: number;
  foundBy: "both" | "full-text" | "semantic";
};

export type SemanticStatus =
  | { state: "ok"; embedded: number; total: number; model: string }
  | { state: "not-configured" }
  | { state: "no-embeddings"; total: number; model: string }
  | { state: "error"; message: string };

export type OrderSearch = {
  results: OrderResult[];
  ftsCount: number; // candidates each half returned
  vectorCount: number;
  semantic: SemanticStatus;
};

async function semanticHalf(query: string): Promise<{ hits: Hit[]; status: SemanticStatus }> {
  if (!embeddingsConfigured()) return { hits: [], status: { state: "not-configured" } };
  const model = embeddingModel();
  const [{ embedded, total }] = await readDb()<{ embedded: number; total: number }[]>`
    SELECT count(*) FILTER (WHERE embedding_model = ${model})::int AS embedded, count(*)::int AS total FROM orders`;
  if (embedded === 0) return { hits: [], status: { state: "no-embeddings", total, model } };
  try {
    const v = await embedQuery(query);
    const hits = await runQuery<Hit>("search_orders_vector", [`[${v.join(",")}]`, model, DEPTH]);
    return { hits: [...hits], status: { state: "ok", embedded, total, model } };
  } catch (e) {
    console.error("semantic search failed", e);
    return { hits: [], status: { state: "error", message: "The embedding service did not respond." } };
  }
}

export async function searchOrders(query: string): Promise<OrderSearch> {
  const [fts, sem] = await Promise.all([
    runQuery<Hit>("search_orders_fts", [query, DEPTH]),
    semanticHalf(query),
  ]);

  const byId = new Map<string, Pick<OrderResult, "fts" | "vector" | "fused">>();
  const entry = (id: string) => {
    let e = byId.get(id);
    if (!e) byId.set(id, (e = { fts: null, vector: null, fused: 0 }));
    return e;
  };
  for (const h of fts) {
    const e = entry(h.id);
    e.fts = { score: Number(h.score), rank: Number(h.rank) };
    e.fused += 1 / (RRF_K + Number(h.rank));
  }
  for (const h of sem.hits) {
    const e = entry(h.id);
    e.vector = { score: Number(h.score), rank: Number(h.rank) };
    e.fused += 1 / (RRF_K + Number(h.rank));
  }

  const top = [...byId.entries()]
    .sort(([a, x], [b, y]) => y.fused - x.fused || Number(a) - Number(b))
    .slice(0, TOP);

  const details = top.length
    ? await runQuery<{
        id: string;
        case_id: string;
        case_no: string;
        court: string;
        order_date: Date;
        order_type: string;
        is_final: boolean;
        text_marked: string;
      }>("search_orders_details", [`{${top.map(([id]) => id).join(",")}}`, query])
    : [];
  const detailById = new Map(details.map((d) => [d.id, d]));

  const results: OrderResult[] = top.flatMap(([id, s]) => {
    const d = detailById.get(id);
    if (!d) return [];
    return [
      {
        id,
        caseId: d.case_id,
        caseNo: d.case_no,
        court: d.court,
        orderDate: d.order_date,
        orderType: d.order_type,
        isFinal: d.is_final,
        textMarked: d.text_marked,
        ...s,
        foundBy: s.fts && s.vector ? "both" : s.fts ? "full-text" : "semantic",
      },
    ];
  });

  return { results, ftsCount: fts.length, vectorCount: sem.hits.length, semantic: sem.status };
}
