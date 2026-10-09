import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { EMPTY_CASE, getCaseFormOptions } from "@/lib/case-admin";

import { createCase } from "../actions";
import { CaseForm } from "../case-form";

export const metadata: Metadata = { title: "New case" };
export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  await requireAdmin();
  const options = await getCaseFormOptions();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>New case</CardTitle>
          <CardDescription>Register a case. Parties, sections and orders are added separately.</CardDescription>
        </CardHeader>
        <CardContent>
          <CaseForm action={createCase} options={options} initial={EMPTY_CASE} submitLabel="Add case" cancelHref="/cases" />
        </CardContent>
      </Card>
    </main>
  );
}
