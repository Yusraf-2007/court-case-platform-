import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

// Small building blocks shared by the admin pages.

export function PageHead({ kicker, title, sub, actions }: { kicker: string; title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-maroon text-kicker uppercase">{kicker}</p>
        <h1 className="text-title mt-1 font-serif font-semibold">{title}</h1>
        {sub ? <p className="text-muted-foreground mt-1">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, sub, actions, children, id, className }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={cn("bg-card border-border scroll-mt-6 rounded-sm border px-5 py-5 sm:px-6", className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          {sub ? <p className="text-muted-foreground text-sm">{sub}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

// Status in words with a small coloured dot: colour carries meaning only
// here, and sparingly.
const DOT: Record<string, string> = {
  pending: "bg-maroon",
  disposed: "bg-ink/40",
  stayed: "bg-brass",
  abated: "bg-ink/20",
  archived: "bg-ink/20",
};

export function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("size-1.5 rounded-full", DOT[value] ?? "bg-ink/30")} aria-hidden />
      {humanize(value)}
    </span>
  );
}

export function Figure({ value, label, note, tone }: { value: React.ReactNode; label: string; note?: React.ReactNode; tone?: "accent" }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <dt className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">{label}</dt>
      <dd className={cn("font-sans text-3xl font-semibold tabular-nums", tone === "accent" && "text-maroon")}>{value}</dd>
      {note ? <dd className="text-muted-foreground text-xs leading-snug">{note}</dd> : null}
    </div>
  );
}
