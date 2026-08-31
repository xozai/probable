"use server";

import { redirect } from "next/navigation";

import { withErrorFlash } from "@/app/error-flash";
import { replaceFirmSectionTemplates } from "@/sections/service";
import { SectionValidationError } from "@/sections/validation";

export async function updateSectionTemplatesAction(
  firmId: string,
  formData: FormData,
): Promise<void> {
  const raw = formData.get("sections");
  const names =
    typeof raw === "string"
      ? raw.split("\n").filter((name) => name.trim().length > 0)
      : [];
  try {
    await replaceFirmSectionTemplates(firmId, names);
  } catch (error) {
    if (error instanceof SectionValidationError) {
      redirect(withErrorFlash(`/firms/${firmId}/sections`, error.message));
    }
    throw error;
  }
  redirect(`/firms/${firmId}/sections`);
}
