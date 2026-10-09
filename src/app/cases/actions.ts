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
import { parseCaseId } from "@/lib/case-detail";

export type CaseFormState = { values?: CaseFormValues; errors?: FieldErrors; formError?: string };

// Shared by create and update. id is bound into the action on the edit page,
// so it never comes from the submitted form.
async function save(id: number | null, form: FormData): Promise<CaseFormState> {
  const user = await requireAdmin();
  const values = readCaseForm(form);
  const { errors, input } = validateCase(values, await getCaseFormOptions());
  if (!input) return { values, errors };

  let savedId: number | null;
  try {
    savedId = await saveCase(user, input, id);
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
  if (savedId === null) return { values, formError: "This case no longer exists." };

  revalidatePath("/cases");
  redirect(`/cases/${savedId}`);
}

export async function createCase(_prev: CaseFormState, form: FormData): Promise<CaseFormState> {
  return save(null, form);
}

export async function updateCase(rawId: string, _prev: CaseFormState, form: FormData): Promise<CaseFormState> {
  const id = parseCaseId(rawId);
  if (id === null) return { formError: "Unknown case." };
  return save(id, form);
}
