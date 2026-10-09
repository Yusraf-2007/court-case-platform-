"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/lib/admin/form-spec";
import { receiptQuery } from "@/lib/admin/receipt";
import { ERRORS, LABEL, dependentsOf, fieldsFor, removeRecord, saveRecord, type Kind } from "@/lib/admin/records";
import { dbErrorState, validateFields } from "@/lib/admin/validate";
import { requireAdmin } from "@/lib/auth";
import { parseCaseId } from "@/lib/case-detail";

// kind, case id and record id are bound on the server when the page renders
// (Function.bind), so the form cannot redirect a write to another record.
// They are still re-validated here: bound arguments travel through the client.

const KIND_SEGMENT: Record<Kind, string> = { party: "parties", hearing: "hearings", order: "orders" };
const isKind = (k: string): k is Kind => k === "party" || k === "hearing" || k === "order";

export async function saveRecordAction(
  kind: string,
  rawCaseId: string,
  rawId: string | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const caseId = parseCaseId(rawCaseId);
  const id = rawId === null ? null : parseCaseId(rawId);
  if (!isKind(kind) || caseId === null || (rawId !== null && id === null)) return { formError: "Unknown record." };

  const specs = await fieldsFor(kind, caseId, id !== null);
  const { values, errors, clean, ok } = validateFields(specs, form);
  if (!ok) return { values, errors };

  let receipt: Awaited<ReturnType<typeof saveRecord>>;
  try {
    receipt = await saveRecord(admin, kind, caseId, id, clean);
  } catch (e) {
    return dbErrorState(e, ERRORS[kind], values, LABEL[kind]);
  }
  if (!receipt.value) return { values, formError: `This ${LABEL[kind]} no longer exists.` };

  revalidatePath(`/cases/${caseId}`);
  const done = `${kind}_${id === null ? "added" : "saved"}` as const;
  redirect(`/admin/cases/${caseId}?${receiptQuery(done, receipt)}#${KIND_SEGMENT[kind]}`);
}

export async function removeRecordAction(kind: string, rawCaseId: string, rawId: string) {
  const admin = await requireAdmin();
  const caseId = parseCaseId(rawCaseId);
  const id = parseCaseId(rawId);
  if (!isKind(kind) || caseId === null || id === null) redirect("/admin/cases");

  // Refuse while anything depends on it; the confirm page lists what.
  if ((await dependentsOf(kind, caseId, id)).length) redirect(`/admin/cases/${caseId}/${KIND_SEGMENT[kind]}/${id}/delete`);
  let receipt: Awaited<ReturnType<typeof removeRecord>>;
  try {
    receipt = await removeRecord(admin, kind, caseId, id);
  } catch (e) {
    console.error(`remove ${kind} failed`, e);
    redirect(`/admin/cases/${caseId}/${KIND_SEGMENT[kind]}/${id}/delete`);
  }
  revalidatePath(`/cases/${caseId}`);
  redirect(`/admin/cases/${caseId}?${receiptQuery(`${kind}_removed`, receipt)}#${KIND_SEGMENT[kind]}`);
}
