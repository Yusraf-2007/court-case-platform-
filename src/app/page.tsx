import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { CaseLookup } from "@/components/case-lookup";
import { CountUp } from "@/components/count-up";
import { CourtHierarchy } from "@/components/court-hierarchy";
import { Reveal } from "@/components/reveal";
import { Seal } from "@/components/seal";
import { getFilterOptions } from "@/lib/cases";
import { getLandingStats } from "@/lib/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, options] = await Promise.all([getLandingStats(), getFilterOptions()]);
  const caseTypes = options.caseTypes.map((t) => ({ code: t.code, name: t.name }));

  const figures = [
    { value: stats.cases, label: "Cases on record" },
    { value: stats.courts, label: "Courts" },
    { value: stats.states, label: "States & UTs" },
    { value: stats.disposed, label: "Cases disposed" },
  ];

  return (
    <main>
      {/* Hero: name, purpose, and the lookup a litigant came for. */}
      <section className="relative overflow-hidden">
        <Pilaster className="left-0" />
        <Pilaster className="right-0" />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-14 pb-16 text-center sm:pt-20">
          <div className="seal-settle">
            <Seal turning className="size-24 sm:size-28" />
          </div>
          <p className="font-display text-maroon text-kicker rise-in mt-6 uppercase" style={{ animationDelay: "80ms" }}>
            Criminal Case Registry · Courts of India
          </p>
          <h1 className="font-display text-hero rise-in mt-3 font-semibold tracking-[0.06em] uppercase" style={{ animationDelay: "120ms" }}>
            Court Case Platform
          </h1>
          <p className="text-lead text-muted-foreground rise-in mt-4 max-w-xl font-serif" style={{ animationDelay: "160ms" }}>
            Find a criminal case by its number: where it stands, what the court has ordered, and what comes next.
          </p>

          <div
            className="bg-card border-border rise-in relative mt-10 w-full rounded-sm border text-left shadow-[0_1px_0_var(--border),0_12px_32px_-18px_color-mix(in_oklch,var(--ink)_45%,transparent)]"
            style={{ animationDelay: "240ms" }}
          >
            <div className="border-brass h-1 border-y" aria-hidden />
            {/* Ruled margin, as on an order sheet */}
            <div className="border-maroon/30 ml-6 border-l py-6 pr-6 pl-5 sm:ml-10 sm:pl-7">
              <h2 className="font-display text-kicker uppercase">Case lookup</h2>
              <p className="text-muted-foreground mt-1 mb-5 font-serif">
                Enter the register, number and year printed on your summons or order sheet, for example{" "}
                <span className="text-foreground whitespace-nowrap">G.R. 412/2024</span>.
              </p>
              <CaseLookup caseTypes={caseTypes} />
              <p className="text-muted-foreground mt-4 text-sm">
                Only know a name?{" "}
                <Link href="/search" className="text-maroon underline-offset-4 hover:underline">
                  Search by party
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live figures */}
      <section className="bg-ink text-ink-foreground border-brass/60 border-y">
        <Reveal className="mx-auto w-full max-w-6xl px-4 py-12">
          <dl className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
            {figures.map((f, i) => (
              <div
                key={f.label}
                className={`flex flex-col items-center gap-2 px-4 text-center ${i % 2 === 1 ? "border-brass/40 border-l" : ""} ${i === 2 ? "lg:border-brass/40 lg:border-l" : ""}`}
              >
                <dt className="font-display text-ink-foreground/70 order-2 text-kicker uppercase">{f.label}</dt>
                <dd className="text-figure order-1 font-sans font-semibold">
                  <CountUp value={f.value} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-ink-foreground/60 mx-auto mt-10 max-w-2xl text-center font-serif text-sm italic">
            Counted from the platform&rsquo;s database when this page was loaded: rows in the cases and
            courts tables, and the states and union territories assigned to a High Court. The cases are
            synthetic.
          </p>
        </Reveal>
      </section>

      {/* Hierarchy */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <Reveal className="mb-12 text-center">
          <p className="font-display text-maroon text-kicker uppercase">The courts</p>
          <h2 className="text-title mt-2 font-serif font-semibold">From the district to the Supreme Court</h2>
          <div className="rule-ornament mx-auto mt-5 max-w-xs" aria-hidden>
            <span className="bg-brass size-1.5 rotate-45" />
          </div>
        </Reveal>
        <Reveal delay={100}>
          <CourtHierarchy byLevel={stats.byLevel} />
        </Reveal>
      </section>

      {/* Onward */}
      <section className="border-border border-t">
        <Reveal className="mx-auto grid w-full max-w-6xl gap-px px-4 py-14 sm:grid-cols-3">
          {[
            { href: "/cases", title: "Browse the register", text: "Every case on record, filtered by court, register and status." },
            { href: "/search", title: "Search", text: "By case number, or by the name of a party." },
            { href: "/deadlines", title: "Deadlines", text: "Time limits for appeals and revisions, once verified." },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group hover:bg-card flex flex-col gap-1 px-5 py-4 transition-colors">
              <span className="flex items-center gap-2 font-serif text-xl font-semibold">
                {l.title}
                <ArrowRightIcon className="text-maroon size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </span>
              <span className="text-muted-foreground">{l.text}</span>
            </Link>
          ))}
        </Reveal>
      </section>
    </main>
  );
}

// A fluted column at the edge of the hero, on wide screens only.
function Pilaster({ className }: { className: string }) {
  return (
    <div className={`pointer-events-none absolute inset-y-0 hidden w-16 flex-col xl:flex ${className}`} aria-hidden>
      <div className="bg-ink/15 h-3" />
      <div className="bg-ink/10 mx-1 h-2" />
      <div className="border-ink/15 mx-2 flex-1 border-x [background:repeating-linear-gradient(to_right,transparent_0_7px,color-mix(in_oklch,var(--ink)_9%,transparent)_7px_8px)]" />
      <div className="bg-ink/10 mx-1 h-2" />
      <div className="bg-ink/15 h-3" />
    </div>
  );
}
