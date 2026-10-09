import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CaseLookup } from "@/components/case-lookup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFilterOptions } from "@/lib/cases";
import { humanize, statusVariant } from "@/lib/format";
import { findCaseByNumber, searchByNumber, searchByParty, type SearchHit } from "@/lib/search";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const caseTypes = options.caseTypes.map((t) => ({ code: t.code, name: t.name }));

  const type = one(params.type);
  const number = one(params.number);
  const year = one(params.year);
  const party = one(params.party).slice(0, 80);

  // Validate before anything reaches a query.
  const validType = caseTypes.some((t) => t.code === type);
  const validNumber = /^\d{1,9}$/.test(number);
  const validYear = /^\d{4}$/.test(year);

  let hits: SearchHit[] | null = null;
  let heading = "";
  if (validNumber) {
    if (validType && validYear) {
      const id = await findCaseByNumber(type, Number(number), Number(year));
      if (id) redirect(`/cases/${id}`);
      heading = `No ${type} ${number}/${year} found. Cases numbered ${number} in any register or year:`;
    } else {
      heading = `Cases numbered ${number}:`;
    }
    hits = await searchByNumber(Number(number));
  } else if (party.length >= 2) {
    hits = await searchByParty(party);
    heading = `Cases with a party named “${party}”:`;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
      <div className="rise-in">
        <p className="font-display text-brass text-xs tracking-[0.25em] uppercase">Search</p>
        <h1 className="font-serif text-4xl font-semibold">Find a case</h1>
        <p className="text-muted-foreground mt-2 font-serif text-lg">
          By the case number on your papers, or by the name of a party.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="bg-card border-border rounded-md border p-5">
          <h2 className="font-display mb-4 text-sm tracking-[0.15em] uppercase">By case number</h2>
          <CaseLookup caseTypes={caseTypes} defaults={{ type: type || undefined, number, year }} compact />
        </section>
        <section className="bg-card border-border rounded-md border p-5">
          <h2 className="font-display mb-4 text-sm tracking-[0.15em] uppercase">By party name</h2>
          <form action="/search" method="get" className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="party" className="text-muted-foreground text-xs tracking-wide uppercase">
                Name of complainant, accused or other party
              </Label>
              <Input id="party" name="party" defaultValue={party} minLength={2} maxLength={80} className="h-11 text-base" required />
            </div>
            <Button type="submit" variant="outline" size="lg">
              Search by name
            </Button>
          </form>
        </section>
      </div>

      {hits !== null ? (
        <section aria-live="polite" className="flex flex-col gap-3">
          <h2 className="font-serif text-xl">{heading}</h2>
          {hits.length === 0 ? (
            <p className="text-muted-foreground">No matching cases.</p>
          ) : (
            <ul className="divide-border bg-card border-border divide-y rounded-md border">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link href={`/cases/${h.id}`} className="hover:bg-muted flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="font-medium">{h.case_no}</span>
                    <span className="text-muted-foreground text-sm">{h.court}</span>
                    {h.matched ? <span className="text-sm">Party: {h.matched}</span> : null}
                    <Badge variant={statusVariant[h.status] ?? "outline"} className="ml-auto">
                      {humanize(h.status)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
