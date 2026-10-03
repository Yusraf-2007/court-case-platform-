import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_SIZE, getFilterOptions, listCases, parseFilters, type CaseFilters } from "@/lib/cases";
import { formatDate, humanize, statusVariant } from "@/lib/format";

export const metadata: Metadata = { title: "Cases" };

// Filters live in the URL, so every page is rendered per request.
export const dynamic = "force-dynamic";

function pageHref(f: CaseFilters, page: number) {
  const q = new URLSearchParams();
  if (f.courtId) q.set("court", String(f.courtId));
  if (f.caseTypeId) q.set("type", String(f.caseTypeId));
  if (f.stage) q.set("stage", f.stage);
  if (f.status) q.set("status", f.status);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/cases?${s}` : "/cases";
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const options = await getFilterOptions();
  const filters = parseFilters(await searchParams, options);
  const { rows, total } = await listCases(filters);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (filters.page > pages) redirect(pageHref(filters, pages));

  const first = total ? (filters.page - 1) * PAGE_SIZE + 1 : 0;
  const last = (filters.page - 1) * PAGE_SIZE + rows.length;
  const filtered = filters.courtId || filters.caseTypeId || filters.stage || filters.status;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="text-muted-foreground text-sm">
          Criminal cases across the Begusarai courts and their appellate forums.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filtering runs on the server; the URL holds the current view.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action="/cases" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div className="grid gap-2">
              <Label htmlFor="court">Court</Label>
              <NativeSelect id="court" name="court" defaultValue={filters.courtId ?? ""}>
                <option value="">All courts</option>
                {options.courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Case type</Label>
              <NativeSelect id="type" name="type" defaultValue={filters.caseTypeId ?? ""}>
                <option value="">All types</option>
                {options.caseTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code}: {t.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stage">Stage</Label>
              <NativeSelect id="stage" name="stage" defaultValue={filters.stage ?? ""}>
                <option value="">All stages</option>
                {options.stages.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <NativeSelect id="status" name="status" defaultValue={filters.status ?? ""}>
                <option value="">All statuses</option>
                {options.statuses.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Apply
              </Button>
              {filtered ? (
                <Button asChild variant="outline">
                  <Link href="/cases">Reset</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Case</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Court</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Filed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No cases match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/cases/${c.id}`} className="underline-offset-4 hover:underline">
                      {c.case_no}
                    </Link>
                  </TableCell>
                  <TableCell>{c.case_type}</TableCell>
                  <TableCell>{c.court}</TableCell>
                  <TableCell>{c.stage ? humanize(c.stage) : <span className="text-muted-foreground">Not recorded</span>}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] ?? "outline"}>{humanize(c.status)}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {c.filed_on ? formatDate(c.filed_on) : <span className="text-muted-foreground">Not recorded</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
        <p className="text-muted-foreground text-sm tabular-nums">
          {total ? `${first}–${last} of ${total} cases` : "0 cases"}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">
            Page {filters.page} of {pages}
          </span>
          {filters.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(filters, filters.page - 1)}>
                <ChevronLeftIcon /> Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeftIcon /> Previous
            </Button>
          )}
          {filters.page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(filters, filters.page + 1)}>
                Next <ChevronRightIcon />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next <ChevronRightIcon />
            </Button>
          )}
        </div>
      </nav>
    </main>
  );
}
