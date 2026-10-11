// Reciprocal rank fusion, shared by the /search page (lib/order-search.ts)
// and the evaluation harness (db/tests/search_eval.ts), so the harness
// scores exactly the ranking the page shows.
//
//   fused(d) = sum over the lists that contain d of 1 / (K + rank(d))
//
// Ranks, not scores, are fused, so a ts_rank_cd value and a cosine
// similarity never have to be put on one scale. A document found by both
// lists collects two terms, so agreement ranks highest.

export const RRF_K = 60; // Cormack, Clarke and Büttcher (2009)

export type Ranked = { id: string; rank: number };

export function fuse(lists: Ranked[][], k = RRF_K): { id: string; fused: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (const { id, rank } of list) scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
  }
  return [...scores.entries()]
    .map(([id, fused]) => ({ id, fused }))
    .sort((a, b) => b.fused - a.fused || Number(a.id) - Number(b.id));
}
