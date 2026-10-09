import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getCase, parseCaseId } from "@/lib/case-detail";
import { formatDate, humanize, statusVariant } from "@/lib/format";

import { Parties } from "./parties";
import { Timeline } from "./timeline";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// generateMetadata and the page share one fetch per request.
const loadCase = cache(async (raw: string) => {
  const id = parseCaseId(raw);
  return id === null ? null : getCase(id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadCase((await params).id);
  return { title: data ? data.detail.case_no : "Case not found" };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const notRecorded = <span className="text-muted-foreground">Not recorded</span>;

export default async function CasePage({ params }: Props) {
  const session = await getSession();
  const data = await loadCase((await params).id);
  if (!data) notFound();
  const { detail: c, timeline, parties, sections } = data;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <Link
        href="/cases"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> All cases
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{c.case_no}</h1>
          <Badge variant={statusVariant[c.status] ?? "outline"}>{humanize(c.status)}</Badge>
          {session?.role === "admin" ? (
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link href={`/admin/cases/${c.id}/edit`}>
                <PencilIcon /> Edit
              </Link>
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {c.case_type_name} · {c.court}
        </p>
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Court">
              {c.court}
              <span className="text-muted-foreground block text-xs">{c.court_level}</span>
            </Fact>
            <Fact label="Stage">{c.stage ? humanize(c.stage) : notRecorded}</Fact>
            <Fact label="Status">
              {humanize(c.status)}
              {c.disposal_mode ? (
                <span className="text-muted-foreground block text-xs">{humanize(c.disposal_mode)}</span>
              ) : null}
            </Fact>
            <Fact label="Filed">{c.filed_on ? formatDate(c.filed_on) : notRecorded}</Fact>
            <Fact label="Registered">{c.registered_on ? formatDate(c.registered_on) : notRecorded}</Fact>
            <Fact label="Disposed">{c.disposed_on ? formatDate(c.disposed_on) : <span className="text-muted-foreground">—</span>}</Fact>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Hearings and orders in date order.</CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline detail={c} entries={timeline} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>FIR</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {c.fir_number !== null ? (
                <p>
                  FIR {c.fir_number}/{c.fir_year}, {c.fir_police_station} PS
                  {c.fir_date ? (
                    <span className="text-muted-foreground block">dated {formatDate(c.fir_date)}</span>
                  ) : null}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {c.case_type === "GR" ? "No FIR is recorded for this case." : "Not a police case (no FIR)."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <CardDescription>Provisions the case is brought under.</CardDescription>
            </CardHeader>
            <CardContent>
              {sections.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {sections.map((s) => (
                    <li key={`${s.act_name}-${s.section}`} className="flex flex-wrap items-center gap-2">
                      <span className={s.is_dropped ? "text-muted-foreground line-through" : "font-medium"}>
                        {s.act_name} {s.section}
                      </span>
                      {s.title ? <span className="text-muted-foreground">{s.title}</span> : null}
                      {s.is_dropped ? <Badge variant="outline">Dropped before charge</Badge> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No sections are recorded for this case.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parties</CardTitle>
              <CardDescription>Grouped by role, with their advocates.</CardDescription>
            </CardHeader>
            <CardContent>
              <Parties parties={parties} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
