import { CalendarDaysIcon, GavelIcon, InfoIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CaseDetail, TimelineEntry } from "@/lib/case-detail";
import { formatDate, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

const orderLabel: Record<string, string> = {
  summons_warrant: "Summons / warrant",
  charge_framing: "Charge framing",
  other: "Other",
};

const outcomeVariant: Record<string, "default" | "secondary" | "outline"> = {
  proceeded: "outline",
  adjourned: "outline",
  disposed: "secondary",
};

const times = (n: number) => (n === 1 ? "once" : `${n} times`);

function SyntheticNotice({ detail, count }: { detail: CaseDetail; count: number }) {
  const adjourned =
    detail.times_adjourned === null ? "an unstated number of times" : times(detail.times_adjourned);
  return (
    <div className="bg-muted/50 text-muted-foreground flex gap-3 rounded-lg border border-dashed p-3 text-sm">
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="text-foreground font-medium">
          {count} hearing {count === 1 ? "date is" : "dates are"} synthetic.
        </span>{" "}
        The records state this case was listed {times(detail.times_listed ?? 0)} and adjourned {adjourned},
        but not on which dates. Those hearings are shown spaced evenly between filing and{" "}
        {/* 3 Oct 2026 is migration 010's seed anchor date, the end point for pending cases. */}
        {detail.disposed_on ? "disposal" : "3 Oct 2026"}, with the stated number of adjournments and
        any stated reasons. Treat their dates as placeholders. Orders are taken from the records.
      </p>
    </div>
  );
}

export function Timeline({ detail, entries }: { detail: CaseDetail; entries: TimelineEntry[] }) {
  const hearings = entries.filter((e) => e.entry_type === "hearing");
  const synthetic = hearings.filter((e) => e.is_synthetic).length;
  const orders = entries.length - hearings.length;

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No hearings or orders are recorded for this case.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-background flex size-5 items-center justify-center rounded-full border">
            <CalendarDaysIcon className="size-3" aria-hidden />
          </span>
          {hearings.length} {hearings.length === 1 ? "hearing" : "hearings"}
          {synthetic ? ` (${synthetic} synthetic)` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full">
            <GavelIcon className="size-3" aria-hidden />
          </span>
          {orders} {orders === 1 ? "order" : "orders"}
        </span>
      </div>

      {synthetic > 0 ? <SyntheticNotice detail={detail} count={synthetic} /> : null}

      <ol className="relative ml-3 border-l">
        {entries.map((e) => {
          const isHearing = e.entry_type === "hearing";
          return (
            <li key={`${e.entry_type}-${e.entry_id}`} className="relative ml-6 pb-4 last:pb-0">
              <span
                className={cn(
                  "ring-background absolute top-2.5 -left-[2.3rem] flex size-6 items-center justify-center rounded-full ring-4",
                  isHearing
                    ? "bg-background text-muted-foreground border"
                    : "bg-primary text-primary-foreground",
                  isHearing && e.is_synthetic && "border-dashed",
                )}
              >
                {isHearing ? (
                  <CalendarDaysIcon className="size-3.5" aria-hidden />
                ) : (
                  <GavelIcon className="size-3.5" aria-hidden />
                )}
              </span>

              <div
                className={cn(
                  "rounded-lg border p-3",
                  isHearing ? "bg-background" : "bg-card shadow-xs",
                  isHearing && e.is_synthetic && "bg-muted/30 border-dashed",
                  e.is_final && "border-primary",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <time
                    dateTime={e.entry_date.toISOString().slice(0, 10)}
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      e.is_synthetic && "text-muted-foreground italic",
                    )}
                  >
                    {e.is_synthetic ? "≈ " : ""}
                    {formatDate(e.entry_date)}
                  </time>
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {isHearing ? "Hearing" : "Order"}
                  </span>
                  {isHearing ? (
                    <Badge variant={outcomeVariant[e.kind] ?? "outline"}>{humanize(e.kind)}</Badge>
                  ) : (
                    <Badge variant="secondary">{orderLabel[e.kind] ?? humanize(e.kind)}</Badge>
                  )}
                  {e.is_final ? <Badge>Final order</Badge> : null}
                  {e.is_synthetic ? (
                    <Badge
                      variant="outline"
                      className="border-dashed"
                      title="Generated from the stated number of listings; the date is a placeholder."
                    >
                      Synthetic date
                    </Badge>
                  ) : null}
                </div>

                {isHearing ? (
                  e.detail || e.next_date ? (
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      {e.detail ? `Reason: ${humanize(e.detail)}` : null}
                      {e.detail && e.next_date ? " · " : null}
                      {e.next_date
                        ? `Next date ${e.is_synthetic ? "≈ " : ""}${formatDate(e.next_date)}`
                        : null}
                    </p>
                  ) : null
                ) : (
                  <p className="mt-1.5 text-sm">{e.detail}</p>
                )}

                {e.judge ? <p className="text-muted-foreground mt-1 text-xs">{e.judge}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
