import type { Metadata } from "next";
import { CircleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { readDb } from "@/lib/db-read";
import { humanize } from "@/lib/format";

export const metadata: Metadata = { title: "Deadlines" };
export const dynamic = "force-dynamic";

type Rule = {
  trigger_event: string;
  remedy: string;
  forum: string | null;
  days: number | null;
  verified: boolean;
  notes: string | null;
};

// Deadlines are computed only from usable_limitation_rules (migration 001),
// which holds verified rules alone. Until a rule is verified this page says
// so, rather than computing a date from a period nobody has confirmed.
export default async function DeadlinesPage() {
  const sql = readDb();
  const [[counts], rules] = await Promise.all([
    sql<{ total: number; verified: number }[]>`
      SELECT (SELECT count(*) FROM limitation_rules)::int        AS total,
             (SELECT count(*) FROM usable_limitation_rules)::int AS verified`,
    sql<Rule[]>`
      SELECT r.trigger_event, r.remedy, cl.name AS forum, r.days, r.verified, r.notes
      FROM limitation_rules r
      LEFT JOIN court_levels cl ON cl.level = r.forum_level
      ORDER BY r.id`,
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="rise-in">
        <p className="font-display text-brass text-xs tracking-[0.25em] uppercase">Limitation</p>
        <h1 className="font-serif text-4xl font-semibold">Deadlines</h1>
        <p className="text-muted-foreground mt-2 font-serif text-lg">
          Time limits for filing an appeal or revision, counted from the order being challenged.
        </p>
      </div>

      {counts.verified === 0 ? (
        <section role="status" className="bg-card border-maroon/40 flex gap-4 rounded-md border-l-4 border-y border-r p-5">
          <CircleAlertIcon className="text-maroon mt-1 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-serif text-xl">
              {counts.total} limitation {counts.total === 1 ? "rule" : "rules"} defined, {counts.verified} verified.
            </p>
            <p className="text-muted-foreground mt-1">
              Deadlines are not computed until a rule is marked verified.
            </p>
          </div>
        </section>
      ) : (
        <p className="font-serif text-xl">
          {counts.total} limitation rules defined, {counts.verified} verified.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm tracking-[0.15em] uppercase">Rules on file</h2>
        <ul className="divide-border bg-card border-border divide-y rounded-md border">
          {rules.map((r, i) => (
            <li key={i} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {humanize(r.remedy)} against {humanize(r.trigger_event).toLowerCase()}
                </p>
                <p className="text-muted-foreground text-sm">
                  {r.forum ? `To the ${r.forum}` : "Forum not stated"} ·{" "}
                  {r.days !== null ? `${r.days} days (proposed)` : "Period not yet known"}
                </p>
                {r.notes ? <p className="text-muted-foreground mt-1 text-xs">{r.notes}</p> : null}
              </div>
              {r.verified ? (
                <Badge>Verified</Badge>
              ) : (
                <Badge variant="outline" className="border-maroon/50 text-maroon">
                  Not verified
                </Badge>
              )}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-sm">
          Periods are marked verified only after they are checked against the statute. A wrong
          deadline is worse than none.
        </p>
      </section>
    </main>
  );
}
