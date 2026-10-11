import Link from "next/link";
import { InfoIcon } from "lucide-react";

import type { OrderResult, OrderSearch } from "@/lib/order-search";
import { formatDate, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

// The fused results of the hybrid order search, with each half's rank and
// score beside the fused score, so a reader can see what each method
// contributed and where they agreed.

const FOUND_LABEL: Record<OrderResult["foundBy"], string> = {
  both: "Both",
  "full-text": "Words only",
  semantic: "Meaning only",
};

// ts_headline wraps matches in « »; render them as <mark>, as text.
function Marked({ text }: { text: string }) {
  const parts = text.split(/«|»/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className="bg-brass/25 text-foreground rounded-[2px] px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function SemanticNotice({ search }: { search: OrderSearch }) {
  const s = search.semantic;
  if (s.state === "ok") return null;
  const message =
    s.state === "not-configured"
      ? "Semantic search is not configured on this server (no embedding API), so these results come from full-text search alone."
      : s.state === "no-embeddings"
        ? `None of the ${s.total} orders has an embedding from ${s.model} yet, so these results come from full-text search alone.`
        : `${s.message} These results come from full-text search alone.`;
  return (
    <p role="status" className="border-maroon/40 bg-card flex gap-2 rounded-sm border border-l-4 px-4 py-3 text-sm">
      <InfoIcon className="text-maroon mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function OrderResults({ query, search, k }: { query: string; search: OrderSearch; k: number }) {
  const { results } = search;
  const both = results.filter((r) => r.foundBy === "both").length;

  return (
    <section aria-live="polite" className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-xl">Orders matching “{query}”</h2>
        <p className="text-muted-foreground text-sm tabular-nums">
          Full-text found {search.ftsCount}, semantic found {search.vectorCount}
          {search.semantic.state === "ok" ? ` (of ${search.semantic.embedded} embedded orders)` : ""}; top {results.length} after fusion,{" "}
          {both} found by both.
        </p>
      </div>
      <SemanticNotice search={search} />

      {results.length === 0 ? (
        <p className="text-muted-foreground">No orders match.</p>
      ) : (
        <div className="bg-card border-border overflow-x-auto rounded-sm border px-5 pt-4 pb-2">
          <table className="ledger">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Order</th>
                <th>Found by</th>
                <th className="num" title="Rank and ts_rank_cd score among full-text matches">
                  Full-text
                </th>
                <th className="num" title="Rank and cosine similarity among semantic neighbours">
                  Semantic
                </th>
                <th className="num" title={`Reciprocal rank fusion: sum of 1 / (${k} + rank)`}>
                  Fused
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id}>
                  <td className="num dim">{i + 1}</td>
                  <td className="min-w-72">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={`/cases/${r.caseId}`} className="font-medium hover:underline">
                        {r.caseNo}
                      </Link>
                      <span className="dim text-xs">
                        {formatDate(r.orderDate)} · {humanize(r.orderType)}
                        {r.isFinal ? " · final" : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 font-serif text-[0.95rem] leading-snug">
                      <Marked text={r.textMarked} />
                    </p>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={cn("inline-flex items-center gap-1.5", r.foundBy === "both" && "font-medium")}>
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          r.foundBy === "both" ? "bg-maroon" : "border-ink/40 border",
                        )}
                        aria-hidden
                      />
                      {FOUND_LABEL[r.foundBy]}
                    </span>
                  </td>
                  <td className="num">
                    {r.fts ? (
                      <>
                        <span className="dim">#{r.fts.rank}</span> {r.fts.score.toFixed(3)}
                      </>
                    ) : (
                      <span className="dim">–</span>
                    )}
                  </td>
                  <td className="num">
                    {r.vector ? (
                      <>
                        <span className="dim">#{r.vector.rank}</span> {r.vector.score.toFixed(3)}
                      </>
                    ) : (
                      <span className="dim">–</span>
                    )}
                  </td>
                  <td className="num font-semibold">{r.fused.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground border-border mt-2 border-t pt-2 pb-1 text-xs">
            Full-text: rank and ts_rank_cd score. Semantic: rank and cosine similarity (1 = same meaning). Fused: reciprocal rank
            fusion, the sum of 1 / ({k} + rank) over the methods that found the order, so agreement between the two ranks highest.
          </p>
        </div>
      )}
    </section>
  );
}
