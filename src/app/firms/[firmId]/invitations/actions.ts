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
  const invitation = await createInvitationForFirm(firmId, formData.get("email"));
  // Show-once: the invite link (bearer token) is never persisted server-side
  // beyond this single redirect, so it can only be read here or from the
  // email that was just sent.
  redirect(
    `/firms/${firmId}/invitations?invited=${encodeURIComponent(invitation.url)}`,
  );
}

export async function revokeInvitationAction(
  firmId: string,
  invitationId: string,
): Promise<void> {
  await revokeInvitationForFirm(firmId, invitationId);
  redirect(`/firms/${firmId}/invitations`);
}
