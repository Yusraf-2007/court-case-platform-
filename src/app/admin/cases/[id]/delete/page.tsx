import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react";

import { PageHead } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { caseDependents } from "@/lib/case-admin";
import { getCase, parseCaseId } from "@/lib/case-detail";

import { archiveCase, removeCase } from "../../actions";

export const metadata: Metadata = { title: "Delete case · Admin" };
export const dynamic = "force-dynamic";

// The confirmation step. A case with anything depending on it is refused,
// with the count of what is in the way; archiving is offered instead.
export default async function DeleteCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = parseCaseId((await params).id);
  if (id === null) notFound();
  const data = await getCase(id, { includeArchived: true });
  if (!data) notFound();
  const c = data.detail;
  const blockers = await caseDependents(id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <PageHead kicker="Delete case" title={c.case_no} sub={`${c.case_type_name} · ${c.court}`} />

      {blockers.length ? (
        <section role="alert" className="bg-card border-maroon/40 rounded-sm border border-l-4 p-5">
          <p className="flex items-center gap-2 font-serif text-xl">
            <ShieldAlertIcon className="text-maroon size-5" aria-hidden /> This case cannot be deleted.
          </p>
          <p className="mt-2">
            It has <strong>{list(blockers)}</strong>. Deleting it would orphan those records or destroy the case&rsquo;s history.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            To take it off the public register, archive it: it disappears from every public page and keeps all its records. To delete it,
            remove what depends on it first.
          </p>
          <div className="mt-5 flex gap-2">
            {c.deleted_at === null ? (
              <form action={archiveCase.bind(null, String(id))}>
                <Button type="submit">
                  <ArchiveIcon /> Archive instead
                </Button>
              </form>
            ) : null}
            <Button asChild variant="ghost">
              <Link href={`/admin/cases/${id}`}>Back to the case</Link>
            </Button>
          </div>
        </section>
      ) : (
        <section className="bg-card border-destructive/40 rounded-sm border border-l-4 p-5">
          <p className="font-serif text-xl">Delete {c.case_no} permanently?</p>
          <p className="text-muted-foreground mt-2">
            Nothing depends on this case. The case row will be removed; its entries in the audit log are kept, including a record of
            this deletion. This cannot be undone.
          </p>
          <div className="mt-5 flex gap-2">
            <form action={removeCase.bind(null, String(id))}>
              <Button type="submit" variant="destructive">
                <Trash2Icon /> Delete permanently
              </Button>
            </form>
            <Button asChild variant="ghost">
              <Link href={`/admin/cases/${id}`}>Cancel</Link>
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
