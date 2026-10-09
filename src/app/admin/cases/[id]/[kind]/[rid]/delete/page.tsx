import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlertIcon, Trash2Icon } from "lucide-react";

import { PageHead } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { SEGMENT_KIND, isSegment } from "@/lib/admin/form-spec";
import { dependentsOf, loadRecord } from "@/lib/admin/records";
import { requireAdmin } from "@/lib/auth";
import { getCase, parseCaseId } from "@/lib/case-detail";
import { formatDate, humanize } from "@/lib/format";

import { removeRecordAction } from "../../actions";

export const metadata: Metadata = { title: "Delete · Admin" };
export const dynamic = "force-dynamic";

// Confirmation before removing a party, hearing or order. A hearing that
// orders or witnesses refer to is refused, with the count.
export default async function DeleteRecordPage({ params }: { params: Promise<{ id: string; kind: string; rid: string }> }) {
  await requireAdmin();
  const p = await params;
  const caseId = parseCaseId(p.id);
  const rid = parseCaseId(p.rid);
  if (caseId === null || rid === null || !isSegment(p.kind)) notFound();
  const kind = SEGMENT_KIND[p.kind];
  const [data, record, blockers] = await Promise.all([
    getCase(caseId, { includeArchived: true }),
    loadRecord(kind, caseId, rid),
    dependentsOf(kind, caseId, rid),
  ]);
  if (!data || !record) notFound();

  const describe =
    kind === "party"
      ? `${humanize(record.role)}: ${record.full_name}`
      : kind === "hearing"
        ? `Hearing of ${formatDate(new Date(`${record.hearing_date}T00:00:00Z`))} (${humanize(record.outcome)})`
        : `${humanize(record.order_type)} order of ${formatDate(new Date(`${record.order_date}T00:00:00Z`))}`;
  const back = `/admin/cases/${caseId}#${p.kind}`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <PageHead kicker={`${data.detail.case_no} · delete ${kind}`} title={describe} />
      {blockers.length ? (
        <section role="alert" className="bg-card border-maroon/40 rounded-sm border border-l-4 p-5">
          <p className="flex items-center gap-2 font-serif text-xl">
            <ShieldAlertIcon className="text-maroon size-5" aria-hidden /> This {kind} cannot be deleted.
          </p>
          <p className="mt-2">
            <strong>{blockers.join(" and ")}</strong> {blockers.length === 1 && blockers[0].startsWith("1 ") ? "refers" : "refer"} to it. Remove or
            re-link {blockers.length === 1 && blockers[0].startsWith("1 ") ? "it" : "them"} first.
          </p>
          <Button asChild variant="ghost" className="mt-4">
            <Link href={back}>Back to the case</Link>
          </Button>
        </section>
      ) : (
        <section className="bg-card border-destructive/40 rounded-sm border border-l-4 p-5">
          <p className="font-serif text-xl">Delete this {kind}?</p>
          <p className="text-muted-foreground mt-2">
            {kind === "party"
              ? "The person is removed from this case, with their advocate links. The person's record stays, as they may be a party elsewhere."
              : kind === "order" && record.is_final === "yes"
                ? "This is the final order. Deleting it does not reopen the case: edit the case's status for that."
                : "The row is removed."}{" "}
            The audit log keeps a full copy.
          </p>
          <div className="mt-5 flex gap-2">
            <form action={removeRecordAction.bind(null, kind, String(caseId), String(rid))}>
              <Button type="submit" variant="destructive">
                <Trash2Icon /> Delete
              </Button>
            </form>
            <Button asChild variant="ghost">
              <Link href={back}>Cancel</Link>
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
