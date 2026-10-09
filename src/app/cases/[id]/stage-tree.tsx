import { CheckIcon, GavelIcon, MinusIcon, PauseIcon } from "lucide-react";

import { Reveal } from "@/components/reveal";
import type { CaseProgress, StageRow, StageState } from "@/lib/case-stages";
import { formatDate, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

// Where a case stands, for someone with no legal training: the lifecycle
// stages as nodes on one trunk. Reached stages are filled ink with their
// date, the current stage is oxblood and labelled "You are here", stages
// ahead are hollow and muted. A case that closed early shows a branch that
// leaves the trunk at its last stage and rejoins it at disposal.

type Props = { progress: CaseProgress; status: string; disposalMode: string | null };

const NODE_Y = 22; // px from the top of a row to the centre of its node

export function StageTree({ progress, status, disposalMode }: Props) {
  const { rows, closedEarly } = progress;
  const last = rows.length - 1;
  // The branch around stages a closed case never reached.
  const branchFrom = closedEarly ? rows.findIndex((r) => r.state === "skipped") - 1 : -1;
  const closedLabel = disposalMode ? humanize(disposalMode) : status === "abated" ? "Abated" : "Disposed";

  return (
    <div className="flex flex-col gap-8">
      <Summary progress={progress} status={status} closedLabel={closedLabel} />

      <ol className="relative" aria-label="Stages of this case">
        {rows.map((r, i) => {
          const right = i % 2 === 0; // wide screens: cards alternate either side of the trunk
          const inBranch = branchFrom >= 0 && i >= branchFrom && i <= last;
          return (
            <Reveal
              as="li"
              key={r.key}
              delay={Math.min(i, 6) * 40}
              className="relative grid grid-cols-[3rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)]"
            >
              {/* Trunk, node and branch */}
              <div className="relative col-start-1 row-start-1 lg:col-start-2" aria-hidden>
                {i > 0 ? <Segment state={leg(rows[i - 1].state, r.state)} className="top-0" style={{ height: NODE_Y }} /> : null}
                {i < last ? <Segment state={leg(r.state, rows[i + 1].state)} className="bottom-0" style={{ top: NODE_Y }} /> : null}
                {inBranch ? <Branch at={i === branchFrom ? "start" : i === last ? "end" : "middle"} /> : null}
                <Node row={r} final={i === last} />
              </div>

              {/* Date, on the far side of the trunk (wide screens) */}
              <div
                className={cn(
                  "row-start-1 hidden items-start pt-2.5 lg:flex",
                  right ? "lg:col-start-1 justify-end pr-6" : "lg:col-start-3 pl-6",
                )}
              >
                <DateLabel row={r} />
              </div>

              {/* The stage itself, on a branch from its node */}
              <div className={cn("relative col-start-2 row-start-1 pb-7 pl-3 lg:pl-0", right ? "lg:col-start-3 lg:pl-6" : "lg:col-start-1 lg:pr-6")}>
                <span
                  className={cn(
                    "absolute top-[22px] hidden h-px w-6 lg:block",
                    right ? "left-0" : "right-0",
                    r.state === "done" ? "bg-ink/50" : r.state === "current" ? "bg-maroon" : "bg-ink/15",
                  )}
                  aria-hidden
                />
                <StageCard row={r} final={i === last} closedLabel={closedLabel} alignRight={!right} />
              </div>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}

function Summary({ progress, status, closedLabel }: { progress: CaseProgress; status: string; closedLabel: string }) {
  const { rows, current, closed } = progress;
  const total = rows.length;
  const disposal = rows[total - 1];
  const reached = rows.filter((r) => r.state === "done" && r.key !== "disposal").length;

  let headline: React.ReactNode;
  let sub: React.ReactNode;
  if (closed) {
    headline = <>Closed: {closedLabel}</>;
    sub = (
      <>
        {disposal.reachedOn ? `Disposed on ${formatDate(disposal.reachedOn)}. ` : "Disposed; the date is not on record. "}
        {progress.closedEarly ? `The case ended after stage ${rows[reached - 1]?.numeral ?? "I"}, before a full trial.` : "Every stage was completed."}
      </>
    );
  } else if (current) {
    const pos = rows.indexOf(current) + 1;
    headline = (
      <>
        Stage {pos} of {total}: {current.title}
      </>
    );
    sub = current.plain;
  } else {
    headline = "Stage not recorded";
    sub = "The records do not say which stage this case has reached. The stages it is known to have passed are marked below.";
  }

  return (
    <div className="flex flex-col gap-4">
      {status === "stayed" ? (
        <div role="status" className="border-maroon/50 bg-card flex gap-3 rounded-sm border-y border-r border-l-4 p-4">
          <PauseIcon className="text-maroon mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-serif text-lg font-semibold">Proceedings are stayed.</span>{" "}
            <span className="text-muted-foreground">
              A court has paused this case. It will not move to the next stage until the stay is lifted.
            </span>
          </p>
        </div>
      ) : null}
      <div>
        <p className="text-title font-serif font-semibold">{headline}</p>
        {sub ? <p className="text-muted-foreground text-lead mt-1 font-serif">{sub}</p> : null}
      </div>
      {/* The whole path at a glance */}
      <div className="flex gap-1" aria-hidden>
        {rows.map((r) => (
          <span
            key={r.key}
            className={cn(
              "h-1.5 flex-1 rounded-[1px]",
              r.state === "done" && "bg-ink",
              r.state === "current" && "bg-maroon",
              r.state === "upcoming" && "bg-ink/15",
              r.state === "skipped" && "bg-[repeating-linear-gradient(90deg,color-mix(in_oklch,var(--ink)_20%,transparent)_0_3px,transparent_3px_6px)]",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// A stretch of trunk is solid only if the case travelled it: drawn in the
// state of the node it leads to, unless it leaves a stage never reached.
const leg = (from: StageState, to: StageState): StageState => (from === "skipped" ? "skipped" : to);

// The trunk between two nodes.
function Segment({ state, className, style }: { state: StageState; className: string; style: React.CSSProperties }) {
  return (
    <span
      className={cn(
        "absolute left-1/2 -translate-x-1/2",
        state === "done" && "bg-ink w-0.5",
        state === "current" && "bg-maroon w-0.5",
        (state === "upcoming" || state === "skipped") && "border-ink/25 w-0 border-l-2 border-dashed",
        className,
      )}
      style={style}
    />
  );
}

// The path a closed case actually took, around the stages it skipped.
function Branch({ at }: { at: "start" | "middle" | "end" }) {
  const base = "border-maroon absolute left-1/2 w-[18px] lg:w-[24px]";
  if (at === "start") return <span className={cn(base, "bottom-0 rounded-tr-xl border-t-2 border-r-2")} style={{ top: NODE_Y }} />;
  if (at === "end") return <span className={cn(base, "top-0 rounded-br-xl border-r-2 border-b-2")} style={{ height: NODE_Y + 1 }} />;
  return <span className={cn(base, "inset-y-0 border-r-2")} />;
}

function Node({ row, final }: { row: StageRow; final: boolean }) {
  const common = "absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full";
  if (row.state === "current") {
    return (
      <span className={cn(common, "bg-maroon ring-maroon/15 size-11 text-white ring-[6px]")} style={{ top: NODE_Y }}>
        <span className="font-display text-[0.7rem] font-semibold">{row.numeral}</span>
      </span>
    );
  }
  if (row.state === "done") {
    return (
      <span className={cn(common, "bg-ink text-ink-foreground", final ? "size-10" : "size-7")} style={{ top: NODE_Y }}>
        {final ? <GavelIcon className="size-4.5" /> : <CheckIcon className="size-4" strokeWidth={2.5} />}
      </span>
    );
  }
  if (row.state === "skipped") {
    return (
      <span className={cn(common, "bg-background border-ink/25 text-ink/35 size-7 border-2 border-dashed")} style={{ top: NODE_Y }}>
        <MinusIcon className="size-3.5" />
      </span>
    );
  }
  return (
    <span className={cn(common, "bg-background border-ink/25 text-ink/45 size-7 border-2")} style={{ top: NODE_Y }}>
      <span className="font-display text-[0.55rem] font-semibold">{row.numeral}</span>
    </span>
  );
}

function DateLabel({ row }: { row: StageRow }) {
  if (row.state === "upcoming" || row.state === "skipped") return null;
  return row.reachedOn ? (
    <span className={cn("font-sans text-sm font-medium", row.state === "current" && "text-maroon")}>{formatDate(row.reachedOn)}</span>
  ) : (
    <span className="text-muted-foreground/80 text-sm italic">No date on record</span>
  );
}

function StageCard({ row, final, closedLabel, alignRight }: { row: StageRow; final: boolean; closedLabel: string; alignRight: boolean }) {
  const align = alignRight ? "lg:text-right" : "";
  const mobileDate = (
    <p className="mt-0.5 text-sm lg:hidden">
      <DateLabel row={row} />
    </p>
  );

  if (row.state === "current") {
    return (
      <div className={cn("bg-card border-maroon/40 rounded-sm border px-4 py-3 shadow-[0_8px_24px_-16px_color-mix(in_oklch,var(--maroon)_60%,transparent)]", align)}>
        <p className="font-display text-maroon text-kicker uppercase">You are here</p>
        <h3 className="mt-1 font-serif text-2xl font-semibold">{row.title}</h3>
        <p className="mt-0.5 text-sm">
          {row.reachedOn ? (
            <span className="text-maroon font-medium">
              Since {formatDate(row.reachedOn)}
              {row.daysInStage !== null ? ` · ${row.daysInStage} days` : ""}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Date reached not recorded</span>
          )}
        </p>
        <p className="text-muted-foreground mt-2 font-serif text-lg leading-snug">{row.plain}</p>
      </div>
    );
  }

  if (row.state === "done") {
    return (
      <div className={cn("pt-1", align)}>
        <h3 className="font-serif text-xl font-semibold">{final ? `Disposed: ${closedLabel}` : row.title}</h3>
        {mobileDate}
        {row.order ? (
          <p className="text-muted-foreground mt-1 text-sm">“{row.order.text}”</p>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">{row.plain}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("text-muted-foreground pt-1", align)}>
      <h3 className={cn("font-serif text-lg", row.state === "skipped" && "line-through decoration-1")}>{row.title}</h3>
      <p className="text-sm">{row.state === "skipped" ? "Not reached: the case closed first." : row.plain}</p>
    </div>
  );
}
