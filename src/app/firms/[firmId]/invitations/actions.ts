"use server";

import { redirect } from "next/navigation";

import {
  createInvitationForFirm,
  revokeInvitationForFirm,
} from "@/invitations/service";

export async function createInvitationAction(
  firmId: string,
  formData: FormData,
): Promise<void> {
  await createInvitationForFirm(firmId, formData.get("email"));
  redirect(`/firms/${firmId}/invitations`);
}

export async function revokeInvitationAction(
  firmId: string,
  invitationId: string,
): Promise<void> {
  await revokeInvitationForFirm(firmId, invitationId);
  redirect(`/firms/${firmId}/invitations`);
}
