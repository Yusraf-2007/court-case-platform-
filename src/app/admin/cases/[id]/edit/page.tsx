import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getCaseFormOptions, getCaseFormValues } from "@/lib/case-admin";
import { parseCaseId } from "@/lib/case-detail";

import { updateCase } from "../../actions";
import { CaseForm } from "../../case-form";

export const metadata: Metadata = { title: "Edit case" };
export const dynamic = "force-dynamic";

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const raw = (await params).id;
  const id = parseCaseId(raw);
  if (id === null) notFound();

  const [options, values] = await Promise.all([getCaseFormOptions(), getCaseFormValues(id)]);
  if (!values) notFound();

  const typeCode = options.caseTypes.find((t) => String(t.id) === values.case_type_id)?.code ?? "";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>
            Edit {typeCode} {values.case_number}/{values.case_year}
          </CardTitle>
          <CardDescription>Every change is written to the audit log under your name; the database triggers that fire are listed after you save.</CardDescription>
        </CardHeader>
        <CardContent>
          <CaseForm
            action={updateCase.bind(null, String(id))}
            options={options}
            initial={values}
            submitLabel="Save changes"
            cancelHref={`/admin/cases/${id}`}
          />
        </CardContent>
      </Card>
    </main>
  );
}
