"use server";

import { redirect } from "next/navigation";

import { replaceFirmSectionTemplates } from "@/sections/service";

export async function updateSectionTemplatesAction(
  firmId: string,
  formData: FormData,
): Promise<void> {
  const raw = formData.get("sections");
  const names =
    typeof raw === "string"
      ? raw.split("\n").filter((name) => name.trim().length > 0)
      : [];
  await replaceFirmSectionTemplates(firmId, names);
  redirect(`/firms/${firmId}/sections`);
}
