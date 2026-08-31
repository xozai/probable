"use server";

import { redirect } from "next/navigation";

import { withErrorFlash } from "@/app/error-flash";
import {
  createInvitationForFirm,
  revokeInvitationForFirm,
} from "@/invitations/service";
import { InvitationEmailError } from "@/invitations/errors";
import { InvitationValidationError } from "@/invitations/validation";

export async function createInvitationAction(
  firmId: string,
  formData: FormData,
): Promise<void> {
  let invitation;
  try {
    invitation = await createInvitationForFirm(firmId, formData.get("email"));
  } catch (error) {
    if (error instanceof InvitationValidationError || error instanceof InvitationEmailError) {
      redirect(withErrorFlash(`/firms/${firmId}/invitations`, error.message));
    }
    throw error;
  }
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
