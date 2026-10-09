import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminForm } from "@/components/admin/admin-form";
import { PageHead } from "@/components/admin/admin-ui";
import { SEGMENT_KIND, isSegment } from "@/lib/admin/form-spec";
import { fieldsFor, loadRecord, personSharedWith } from "@/lib/admin/records";
import { requireAdmin } from "@/lib/auth";
import { getCase, parseCaseId } from "@/lib/case-detail";

import { saveRecordAction } from "./actions";

const TITLE = { party: "party", hearing: "hearing", order: "order" } as const;

// Add (rid null) or edit a party, hearing or order of one case.
export async function RecordPage({ id: rawId, kind: segment, rid: rawRid }: { id: string; kind: string; rid: string | null }) {
  await requireAdmin();
  const caseId = parseCaseId(rawId);
  const rid = rawRid === null ? null : parseCaseId(rawRid);
  if (caseId === null || !isSegment(segment) || (rawRid !== null && rid === null)) notFound();
  const kind = SEGMENT_KIND[segment];

  const data = await getCase(caseId, { includeArchived: true });
  if (!data) notFound();
  const initial = rid === null ? {} : await loadRecord(kind, caseId, rid);
  if (!initial) notFound();

  const fields = await fieldsFor(kind, caseId, rid !== null);
  const shared = kind === "party" && rid !== null ? await personSharedWith(caseId, rid) : 0;
  const back = `/admin/cases/${caseId}#${segment}`;

  let note: React.ReactNode = null;
  if (shared > 0) {
    note = (
      <p className="border-brass/60 bg-muted/40 rounded-sm border-l-2 px-4 py-3 text-sm">
        This person is also a party to {shared} other {shared === 1 ? "case" : "cases"}. Changes to their name or address apply there too,
        and are logged on each case.
      </p>
    );
  } else if (kind === "order" && rid !== null && initial.is_final === "yes") {
    note = (
      <p className="border-brass/60 bg-muted/40 rounded-sm border-l-2 px-4 py-3 text-sm">
        This is the final order that disposed of the case. Whether an order is final cannot be changed here: the disposal it caused is
        part of the case record. Edit the case to change its status.
      </p>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href={back} className="text-muted-foreground hover:text-foreground w-fit text-sm">
        ← {data.detail.case_no}
      </Link>
      <PageHead kicker={data.detail.case_no} title={`${rid === null ? "Add" : "Edit"} ${TITLE[kind]}`} />
      <div className="bg-card border-border rounded-sm border p-5 sm:p-6">
        <AdminForm
          action={saveRecordAction.bind(null, kind, String(caseId), rid === null ? null : String(rid))}
          fields={fields}
          initial={initial}
          submitLabel={rid === null ? `Add ${TITLE[kind]}` : "Save changes"}
          cancelHref={back}
          note={note}
        />
      </div>
    </main>
  );
}
