import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import type { CaseProgress, StageRow } from "@/lib/case-stages";
import { formatDate, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

// The admin view of a case's progress: the same rows as the public stage
// tree (lib/case-stages.ts, db/queries/case_stages.sql), as a table to
// compare and audit. Sortable by stage order, date reached or days in stage;
// the sort lives in the URL and is applied on the server.

export type StageSort = { key: "stage" | "reached" | "days"; dir: "asc" | "desc" };

export function parseStageSort(params: Record<string, string | string[] | undefined>): StageSort {
  const key = params.sort === "reached" || params.sort === "days" ? params.sort : "stage";
  const dir = params.dir === "desc" ? "desc" : "asc";
  return { key, dir };
}

function sortRows(rows: StageRow[], s: StageSort) {
  const value = (r: StageRow, i: number) =>
    s.key === "reached" ? r.reachedOn?.getTime() ?? null : s.key === "days" ? r.daysInStage : i;
  const indexed = rows.map((r, i) => ({ r, i, v: value(r, i) }));
  indexed.sort((a, b) => {
    // Rows without a value sort last in either direction.
    if (a.v === null && b.v === null) return a.i - b.i;
    if (a.v === null) return 1;
    if (b.v === null) return -1;
    return (s.dir === "asc" ? a.v - b.v : b.v - a.v) || a.i - b.i;
  });
  return indexed.map((x) => x.r);
}

const STATE_LABEL: Record<StageRow["state"], string> = {
  done: "Reached",
  current: "Current",
  upcoming: "Ahead",
  skipped: "Not reached",
};

export function StageTable({ progress, sort, baseHref }: { progress: CaseProgress; sort: StageSort; baseHref: string }) {
  const rows = sortRows(progress.rows, sort);
  const totalDays = progress.rows.reduce((a, r) => a + (r.state === "done" ? (r.daysInStage ?? 0) : 0), 0);

  const head = (key: StageSort["key"], label: string, num = false) => {
    const active = sort.key === key;
    const nextDir = active && sort.dir === "asc" ? "desc" : "asc";
    const href = key === "stage" && nextDir === "asc" ? `${baseHref}#stages` : `${baseHref}?sort=${key}&dir=${nextDir}#stages`;
    return (
      <th className={num ? "num" : undefined} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
        <Link href={href} scroll={false} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
          {label}
          {active ? sort.dir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" /> : null}
        </Link>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="ledger">
        <thead>
          <tr>
            {head("stage", "Stage")}
            <th>State</th>
            {head("reached", "Date reached", true)}
            {head("days", "Days in stage", true)}
            <th>Order that advanced it</th>
            <th>Judge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const muted = r.state === "upcoming" || r.state === "skipped";
            return (
              <tr key={r.key} className={cn(r.state === "current" && "[&>td]:bg-maroon/[0.04]")}>
                <td className={cn("whitespace-nowrap", muted && "dim")}>
                  <span className="text-muted-foreground inline-block w-9 font-mono text-xs">{r.numeral}</span>
                  <span className={cn(r.state === "current" && "font-semibold")}>{r.title}</span>
                </td>
                <td className="whitespace-nowrap">
                  <span className={cn("inline-flex items-center gap-1.5", muted && "dim", r.state === "current" && "text-maroon font-medium")}>
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        r.state === "done" && "bg-ink",
                        r.state === "current" && "bg-maroon",
                        muted && "border-ink/30 border",
                      )}
                      aria-hidden
                    />
                    {STATE_LABEL[r.state]}
                  </span>
                </td>
                <td className="num">{r.reachedOn ? formatDate(r.reachedOn) : <span className="dim">–</span>}</td>
                <td className="num">
                  {r.daysInStage !== null ? (
                    <>
                      {r.daysInStage}
                      {r.state === "current" ? <span className="dim"> so far</span> : null}
                    </>
                  ) : (
                    <span className="dim">–</span>
                  )}
                </td>
                <td className="max-w-80">
                  {r.order ? (
                    <>
                      <span className="text-muted-foreground mr-1.5 text-xs font-medium tracking-wide uppercase">{humanize(r.order.type)}</span>
                      <span className="line-clamp-2">{r.order.text}</span>
                    </>
                  ) : (
                    <span className="dim">{r.key === "institution" || r.key === "registration" ? "From the case record" : "–"}</span>
                  )}
                </td>
                <td className="whitespace-nowrap">{r.order?.judge ?? <span className="dim">–</span>}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Days between dated stages</td>
            <td className="num">{totalDays}</td>
            <td colSpan={2} className="dim font-normal">
              Counts only stages with a date on record and a dated next stage.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
