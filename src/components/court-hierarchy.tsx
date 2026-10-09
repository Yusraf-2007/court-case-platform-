import { ArrowUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// The criminal courts of India drawn as a court building: the Supreme Court
// is the pediment, the High Courts the entablature, and the district courts
// the columns it rests on. Appeals travel upward. Counts are live, keyed by
// court_levels.level (1 JMFC ... 5 Supreme Court).
export function CourtHierarchy({ byLevel }: { byLevel: Record<number, number> }) {
  const n = (level: number) => byLevel[level] ?? 0;
  const district = [
    { level: 3, name: "Sessions Courts", plain: "Try serious offences and hear appeals from magistrates." },
    { level: 2, name: "Chief Judicial Magistrates", plain: "Head the magistracy of each district." },
    { level: 1, name: "Judicial Magistrates", plain: "Where most criminal cases begin." },
  ];

  return (
    <figure className="mx-auto w-full max-w-3xl">
      <div className="relative">
        {/* Pediment */}
        <div className="mx-auto w-[88%]">
          <svg viewBox="0 0 400 92" className="text-ink block w-full" aria-hidden>
            <path d="M4 90 L200 4 L396 90 Z" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
            <path d="M40 84 L200 14 L360 84" fill="none" stroke="var(--brass)" strokeWidth="0.8" />
          </svg>
          <div className="-mt-[3.4rem] pb-2 text-center sm:-mt-[4.1rem]">
            <Tier count={n(5)} name="Supreme Court" />
          </div>
        </div>

        {/* Entablature */}
        <div className="border-ink bg-card mx-auto w-[92%] border-x border-y-2 px-4 py-3 text-center">
          <Tier count={n(4)} name="High Courts" plain="One for each state or group of states. Hear appeals and revisions from the districts." />
        </div>

        {/* Columns */}
        <div className="mx-auto grid w-[86%] grid-cols-3 gap-3 pt-2 sm:gap-6">
          {district.map((d) => (
            <div key={d.level} className="flex flex-col items-center text-center">
              <div className="bg-ink h-1.5 w-full" aria-hidden />
              <div className="border-ink/70 flex w-[90%] flex-1 sm:w-[78%] flex-col justify-start border-x px-1 py-4 [background:repeating-linear-gradient(to_right,transparent_0_9px,color-mix(in_oklch,var(--ink)_7%,transparent)_9px_10px)]">
                <Tier count={n(d.level)} name={d.name} plain={d.plain} small />
              </div>
              <div className="bg-ink h-1.5 w-full" aria-hidden />
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="mx-auto mt-0.5 flex flex-col items-center gap-0.5" aria-hidden>
          <div className="bg-ink/80 h-1 w-[90%]" />
          <div className="bg-ink/60 h-1 w-[95%]" />
          <div className="bg-ink/40 h-1 w-full" />
        </div>

        {/* Direction of appeal */}
        <div className="text-maroon absolute top-[18%] -right-1 hidden h-[64%] flex-col items-center sm:-right-8 sm:flex" aria-hidden>
          <ArrowUpIcon className="size-4" />
          <div className="bg-maroon/60 w-px flex-1" />
          <span className="font-display mt-2 text-[0.65rem] tracking-[0.2em] uppercase [writing-mode:vertical-rl]">Appeal</span>
        </div>
      </div>
      <figcaption className="text-muted-foreground mt-5 text-center font-serif italic">
        Courts on record in this system, by tier. An appeal or revision goes to the tier above.
      </figcaption>
    </figure>
  );
}

function Tier({ count, name, plain, small = false }: { count: number; name: string; plain?: string; small?: boolean }) {
  return (
    <div>
      <p className={cn("font-sans font-semibold", small ? "text-2xl" : "text-3xl")}>{count}</p>
      <p className={cn("font-display uppercase", small ? "text-[0.6rem] leading-tight tracking-[0.06em] [overflow-wrap:anywhere] sm:text-[0.65rem] sm:tracking-[0.14em]" : "text-xs tracking-[0.2em]")}>{name}</p>
      {plain ? <p className={cn("text-muted-foreground mt-1 font-serif", small ? "hidden text-sm leading-snug sm:block" : "")}>{plain}</p> : null}
    </div>
  );
}
