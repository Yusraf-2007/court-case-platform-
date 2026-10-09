"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import {
  describeDbError,
  getCaseFormOptions,
  readCaseForm,
  saveCase,
  validateCase,
  type CaseFormValues,
  type FieldErrors,
} from "@/lib/case-admin";
import { receiptQuery } from "@/lib/admin/receipt";
import { deleteCase, setArchived } from "@/lib/case-admin";
import { parseCaseId } from "@/lib/case-detail";

export type CaseFormState = { values?: CaseFormValues; errors?: FieldErrors; formError?: string };

// Shared by create and update. id is bound into the action on the edit page,
// so it never comes from the submitted form.
async function save(id: number | null, form: FormData): Promise<CaseFormState> {
  const user = await requireAdmin();
  const values = readCaseForm(form);
  const { errors, input } = validateCase(values, await getCaseFormOptions());
  if (!input) return { values, errors };

  let receipt: Awaited<ReturnType<typeof saveCase>>;
  try {
    receipt = await saveCase(user, input, id);
  } catch (e) {
    const known = describeDbError(e);
    if (!known) {
      console.error("saveCase failed", e);
      return { values, formError: "The case could not be saved. Please try again." };
    }
    return known.field
      ? { values, errors: { [known.field]: known.message } }
      : { values, formError: known.message };
  }
  if (receipt.value === null) return { values, formError: "This case no longer exists." };

  revalidatePath("/cases");
  redirect(`/admin/cases/${receipt.value}?${receiptQuery(id === null ? "case_created" : "case_saved", receipt)}`);
}

export async function createCase(_prev: CaseFormState, form: FormData): Promise<CaseFormState> {
  return save(null, form);
}

export async function updateCase(rawId: string, _prev: CaseFormState, form: FormData): Promise<CaseFormState> {
  const id = parseCaseId(rawId);
  if (id === null) return { formError: "Unknown case." };
  return save(id, form);
}

// Archive and restore are bound to the case id on the page; nothing is read
// from the submitted form.
export async function archiveCase(rawId: string) {
  const admin = await requireAdmin();
  const id = parseCaseId(rawId);
  if (id === null) redirect("/admin/cases");
  const r = await setArchived(admin, id, true);
  revalidatePath("/cases");
  redirect(`/admin/cases/${id}?${receiptQuery("case_archived", r)}`);
}

export async function restoreCase(rawId: string) {
  const admin = await requireAdmin();
  const id = parseCaseId(rawId);
  if (id === null) redirect("/admin/cases");
  const r = await setArchived(admin, id, false);
  revalidatePath("/cases");
  redirect(`/admin/cases/${id}?${receiptQuery("case_restored", r)}`);
}

export async function removeCase(rawId: string) {
  const admin = await requireAdmin();
  const id = parseCaseId(rawId);
  if (id === null) redirect("/admin/cases");
  let r: Awaited<ReturnType<typeof deleteCase>>;
  try {
    r = await deleteCase(admin, id);
  } catch (e) {
    // A foreign key refused it: something was added since the page loaded.
    console.error("deleteCase failed", e);
    redirect(`/admin/cases/${id}/delete`);
  }
  if (r.value === "blocked") redirect(`/admin/cases/${id}/delete`);
  revalidatePath("/cases");
  redirect(`/admin/cases?${receiptQuery("case_deleted", r)}`);
}
