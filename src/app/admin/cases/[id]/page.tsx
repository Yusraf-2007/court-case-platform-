import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { ActivityTable } from "@/components/admin/activity-table";
import { PageHead, Panel, Status } from "@/components/admin/admin-ui";
import { WriteReceipt } from "@/components/admin/write-receipt";
import { Button } from "@/components/ui/button";
import { getCaseAudit } from "@/lib/admin/dashboard";
import { parseReceipt } from "@/lib/admin/receipt";
import { requireAdmin } from "@/lib/auth";
import { getCase, parseCaseId } from "@/lib/case-detail";
import { formatDate, humanize } from "@/lib/format";

import { archiveCase, restoreCase } from "../actions";
import { StageTable, parseStageSort } from "./stage-table";

export const metadata: Metadata = { title: "Case · Admin" };
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function RowActions({ editHref, deleteHref, label }: { editHref: string; deleteHref: string; label: string }) {
  return (
    <div className="-my-1.5 flex justify-end gap-1">
      <Button asChild variant="ghost" size="icon" className="size-8" title="Edit">
        <Link href={editHref} aria-label={`Edit ${label}`}>
          <PencilIcon />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="text-destructive size-8" title="Delete">
        <Link href={deleteHref} aria-label={`Delete ${label}`}>
          <Trash2Icon />
        </Link>
      </Button>
    </div>
  );
}

function AddButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        <PlusIcon /> {label}
      </Link>
    </Button>
  );
}

export default async function AdminCasePage({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ id: raw }, sp] = await Promise.all([params, searchParams]);
  const id = parseCaseId(raw);
  if (id === null) notFound();
  const data = await getCase(id, { includeArchived: true });
  if (!data) notFound();
  const { detail: c, timeline, parties, stages } = data;
  const audit = await getCaseAudit(id);
  const receipt = parseReceipt(sp);
  const sort = parseStageSort(sp);
  const base = `/admin/cases/${id}`;

  const hearings = timeline.filter((t) => t.entry_type === "hearing");
  const orders = timeline.filter((t) => t.entry_type === "order");
  const archived = c.deleted_at !== null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <Link href="/admin/cases" className="text-muted-foreground hover:text-foreground w-fit text-sm">
        ← All cases
      </Link>
      <PageHead
        kicker={`${c.case_type_name} · ${c.court}`}
        title={c.case_no}
        sub={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            {archived ? <Status value="archived" /> : <Status value={c.status} />}
            <span>Stage: {c.stage ? humanize(c.stage) : "not recorded"}</span>
            {c.disposal_mode ? <span>Disposal: {humanize(c.disposal_mode)}</span> : null}
          </span>
        }
        actions={
          <>
            {!archived ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/cases/${id}`}>
                  <ExternalLinkIcon /> Public page
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/edit`}>
                <PencilIcon /> Edit
              </Link>
            </Button>
            <form action={(archived ? restoreCase : archiveCase).bind(null, String(id))}>
              <Button type="submit" variant="outline" size="sm">
                {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Restore" : "Archive"}
              </Button>
            </form>
            <Button asChild variant="outline" size="sm" className="text-destructive">
              <Link href={`${base}/delete`}>
                <Trash2Icon /> Delete
              </Link>
            </Button>
          </>
        }
      />

      {receipt ? <WriteReceipt receipt={receipt} /> : null}
      {archived ? (
        <p role="status" className="border-ink/20 bg-muted/50 rounded-sm border px-4 py-3 text-sm">
          Archived on {formatDate(c.deleted_at!)}. Hidden from every public page; its records and history are intact. Restore to publish it again.
        </p>
      ) : null}

      <Panel
        id="stages"
        title="Stages"
        sub="One row per stage, from the order history. The public page shows the same data as a tree."
      >
        <StageTable progress={stages} sort={sort} baseHref={base} />
      </Panel>

      <Panel id="parties" title="Parties" actions={<AddButton href={`${base}/parties/new`} label="Add party" />}>
        {parties.length === 0 ? (
          <p className="text-muted-foreground text-sm">No parties recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Name</th>
                  <th>Address</th>
                  <th className="num">Advocates</th>
                  <th className="num">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parties.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{humanize(p.role)}</td>
                    <td>
                      <span className="font-medium">{p.full_name}</span>
                      {p.relation ? (
                        <span className="dim">
                          {" "}
                          {p.relation} {p.relative_name}
                        </span>
                      ) : null}
                      {p.kind !== "individual" ? <span className="dim"> ({humanize(p.kind)})</span> : null}
                    </td>
                    <td className="dim">{[p.address, p.district].filter(Boolean).join(", ") || "–"}</td>
                    <td className="num">{p.advocates.length || <span className="dim">–</span>}</td>
                    <td className="num">
                      <RowActions editHref={`${base}/parties/${p.id}`} deleteHref={`${base}/parties/${p.id}/delete`} label={p.full_name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        id="hearings"
        title="Hearings"
        sub={hearings.some((h) => h.is_synthetic) ? "Rows marked synthetic were generated from stated counts (migration 010); their dates are demo padding." : undefined}
        actions={<AddButton href={`${base}/hearings/new`} label="Add hearing" />}
      >
        {hearings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hearings recorded.</p>
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="ledger">
              <thead className="bg-card sticky top-0">
                <tr>
                  <th className="num">Date</th>
                  <th>Outcome</th>
                  <th>Purpose</th>
                  <th className="num">Next date</th>
                  <th>Judge</th>
                  <th className="num">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {hearings.map((h) => (
                  <tr key={h.entry_id}>
                    <td className="num">{formatDate(h.entry_date)}</td>
                    <td className="whitespace-nowrap">
                      {humanize(h.kind)}
                      {h.is_synthetic ? <span className="dim text-xs"> · synthetic</span> : null}
                    </td>
                    <td className="dim">{h.detail ? humanize(h.detail) : "–"}</td>
                    <td className="num">{h.next_date ? formatDate(h.next_date) : <span className="dim">–</span>}</td>
                    <td className="whitespace-nowrap">{h.judge ?? <span className="dim">–</span>}</td>
                    <td className="num">
                      <RowActions editHref={`${base}/hearings/${h.entry_id}`} deleteHref={`${base}/hearings/${h.entry_id}/delete`} label={`hearing of ${formatDate(h.entry_date)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel id="orders" title="Orders" actions={<AddButton href={`${base}/orders/new`} label="Add order" />}>
        {orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">No orders recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th className="num">Date</th>
                  <th>Type</th>
                  <th>Order</th>
                  <th>Judge</th>
                  <th className="num">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.entry_id}>
                    <td className="num">{formatDate(o.entry_date)}</td>
                    <td className="whitespace-nowrap">
                      {humanize(o.kind)}
                      {o.is_final ? <span className="text-maroon text-xs font-semibold tracking-wide uppercase"> · Final</span> : null}
                    </td>
                    <td className="max-w-md">{o.detail}</td>
                    <td className="whitespace-nowrap">{o.judge ?? <span className="dim">–</span>}</td>
                    <td className="num">
                      <RowActions editHref={`${base}/orders/${o.entry_id}`} deleteHref={`${base}/orders/${o.entry_id}/delete`} label={`order of ${formatDate(o.entry_date)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel id="history" title="History" sub="This case's entries in case_audit_log, newest first.">
        <ActivityTable rows={audit} showCase={false} />
      </Panel>
    </main>
  );
}
