"use server";

import { redirect } from "next/navigation";

import { createFirmForCurrentUser } from "@/firms/service";

export async function createFirmAction(formData: FormData): Promise<void> {
  const firm = await createFirmForCurrentUser(formData.get("name") as string);
  redirect(`/firms/${firm.id}`);
}
