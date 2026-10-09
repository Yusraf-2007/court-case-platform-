import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { PageHead, Status } from "@/components/admin/admin-ui";
import { WriteReceipt } from "@/components/admin/write-receipt";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { parseReceipt } from "@/lib/admin/receipt";
import { requireAdmin } from "@/lib/auth";
import { PAGE_SIZE, getFilterOptions, listCases, parseFilters, type CaseFilters } from "@/lib/cases";
import { formatDate, humanize } from "@/lib/format";

import { archiveCase, restoreCase } from "./actions";

export const metadata: Metadata = { title: "Cases · Admin" };
export const dynamic = "force-dynamic";

function pageHref(f: CaseFilters, page: number) {
  const q = new URLSearchParams();
  if (f.courtId) q.set("court", String(f.courtId));
  if (f.caseTypeId) q.set("type", String(f.caseTypeId));
  if (f.stage) q.set("stage", f.stage);
  if (f.status) q.set("status", f.status);
  if (f.archived !== "live") q.set("archived", f.archived);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/admin/cases?${s}` : "/admin/cases";
}

export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const receipt = parseReceipt(params);
  const options = await getFilterOptions();
  // Same filters as the public list (parseFilters), plus the archive view.
  const filters = parseFilters(params, options, { admin: true });
  const { rows, total } = await listCases(filters);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (filters.page > pages) redirect(pageHref(filters, pages));
  const first = total ? (filters.page - 1) * PAGE_SIZE + 1 : 0;
  const last = (filters.page - 1) * PAGE_SIZE + rows.length;
  const filtered = filters.courtId || filters.caseTypeId || filters.stage || filters.status || filters.archived !== "live";

  const select = (id: string, label: string, value: string | number | null, all: string, opts: { value: string | number; label: string }[]) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
        {label}
      </Label>
      <NativeSelect id={id} name={id} defaultValue={value ?? ""}>
        {all ? <option value="">{all}</option> : null}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <PageHead
        kicker="Cases"
        title="Register"
        sub="Add, edit, archive or delete. Archived cases are hidden from the public pages but keep their history."
        actions={
          <Button asChild>
            <Link href="/admin/cases/new">
              <PlusIcon /> Register a case
            </Link>
          </Button>
        }
      />

      {receipt ? <WriteReceipt receipt={receipt} /> : null}

      <form method="get" action="/admin/cases" className="bg-card border-border grid gap-4 rounded-sm border p-4 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        {select("court", "Court", filters.courtId, "All courts", options.courts.map((c) => ({ value: c.id, label: c.name })))}
        {select("type", "Case type", filters.caseTypeId, "All types", options.caseTypes.map((t) => ({ value: t.id, label: `${t.code}: ${t.name}` })))}
        {select("stage", "Stage", filters.stage, "All stages", options.stages.map((s) => ({ value: s, label: humanize(s) })))}
        {select("status", "Status", filters.status, "All statuses", options.statuses.map((s) => ({ value: s, label: humanize(s) })))}
        {select("archived", "Archive", filters.archived === "live" ? "" : filters.archived, "Not archived", [
          { value: "all", label: "All cases" },
          { value: "archived", label: "Archived only" },
        ])}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Apply
          </Button>
          {filtered ? (
            <Button asChild variant="outline">
              <Link href="/admin/cases">Reset</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <div className="bg-card border-border overflow-x-auto rounded-sm border px-5 pt-4 pb-2">
        <table className="ledger">
          <thead>
            <tr>
              <th>Case</th>
              <th>Court</th>
              <th>Stage</th>
              <th>Status</th>
              <th className="num">Filed</th>
              <th className="num">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="dim py-10 text-center">
                  No cases match these filters.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className={c.deleted_at ? "opacity-60" : undefined}>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/cases/${c.id}`} className="font-medium hover:underline">
                      {c.case_no}
                    </Link>
                  </td>
                  <td>{c.court}</td>
                  <td>{c.stage ? humanize(c.stage) : <span className="dim">Not recorded</span>}</td>
                  <td>{c.deleted_at ? <Status value="archived" /> : <Status value={c.status} />}</td>
                  <td className="num">{c.filed_on ? formatDate(c.filed_on) : <span className="dim">–</span>}</td>
                  <td className="num">
                    <div className="-my-1.5 flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="size-8" title="Edit">
                        <Link href={`/admin/cases/${c.id}/edit`} aria-label={`Edit ${c.case_no}`}>
                          <PencilIcon />
                        </Link>
                      </Button>
                      <form action={(c.deleted_at ? restoreCase : archiveCase).bind(null, String(c.id))}>
                        <Button type="submit" variant="ghost" size="icon" className="size-8" title={c.deleted_at ? "Restore" : "Archive"} aria-label={`${c.deleted_at ? "Restore" : "Archive"} ${c.case_no}`}>
                          {c.deleted_at ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                        </Button>
                      </form>
                      <Button asChild variant="ghost" size="icon" className="text-destructive size-8" title="Delete">
                        <Link href={`/admin/cases/${c.id}/delete`} aria-label={`Delete ${c.case_no}`}>
                          <Trash2Icon />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
        <p className="text-muted-foreground text-sm tabular-nums">{total ? `${first}–${last} of ${total} cases` : "0 cases"}</p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">
            Page {filters.page} of {pages}
          </span>
          <Button asChild={filters.page > 1} variant="outline" size="sm" disabled={filters.page <= 1}>
            {filters.page > 1 ? (
              <Link href={pageHref(filters, filters.page - 1)}>
                <ChevronLeftIcon /> Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ChevronLeftIcon /> Previous
              </span>
            )}
          </Button>
          <Button asChild={filters.page < pages} variant="outline" size="sm" disabled={filters.page >= pages}>
            {filters.page < pages ? (
              <Link href={pageHref(filters, filters.page + 1)}>
                Next <ChevronRightIcon />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                Next <ChevronRightIcon />
              </span>
            )}
          </Button>
        </div>
      </nav>
    </main>
  );
}
