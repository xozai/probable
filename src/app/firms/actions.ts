"use server";

import { redirect } from "next/navigation";

import { withErrorFlash } from "@/app/error-flash";
import { createFirmForCurrentUser, FirmValidationError } from "@/firms/service";

export async function createFirmAction(formData: FormData): Promise<void> {
  let firm;
  try {
    firm = await createFirmForCurrentUser(formData.get("name") as string);
  } catch (error) {
    if (error instanceof FirmValidationError) {
      redirect(withErrorFlash("/firms", error.message));
    }
    throw error;
  }
  redirect(`/firms/${firm.id}`);
}
