import { requireAuthenticatedUser, requireFirmOwner } from "../auth/authorization";
import { db } from "../db/client";

import { InvitationEmailError, InvitationNotFoundError } from "./errors";
import { sendInvitationEmail } from "./mailer";
import {
  claimInvitation as claimInvitationRow,
  createInvitation as createInvitationRow,
  listInvitations as listInvitationsRow,
  revokeInvitation as revokeInvitationRow,
  type ClaimInvitationResult,
  type CreatedInvitation,
  type InvitationSummary,
} from "./repository";
import { validateInviteEmail } from "./validation";

export type {
  ClaimInvitationResult,
  CreatedInvitation,
  InvitationSummary,
} from "./repository";

export interface CreatedInvitationWithUrl extends CreatedInvitation {
  url: string;
}

function buildInvitationUrl(token: string): string {
  return new URL(`/invite/${token}`, process.env.AUTH_URL ?? "http://localhost:3000").toString();
}

export async function createInvitationForFirm(
  firmId: string,
  email: unknown,
): Promise<CreatedInvitationWithUrl> {
  const access = await requireFirmOwner(firmId);
  const validEmail = validateInviteEmail(email);
  const invitation = await createInvitationRow(db, {
    firmId,
    email: validEmail,
    createdBy: access.userId,
  });
  const url = buildInvitationUrl(invitation.token);
  try {
    await sendInvitationEmail({ email: validEmail, url });
  } catch (error) {
    // The invitation row is already committed; surface the failure instead
    // of letting it escape as a raw 500 with no indication a pending
    // invitation now exists (see #33 item 3).
    throw new InvitationEmailError(validEmail, error);
  }
  return { ...invitation, url };
}

export async function listInvitationsForFirm(
  firmId: string,
): Promise<InvitationSummary[]> {
  await requireFirmOwner(firmId);
  return listInvitationsRow(db, firmId);
}

export async function revokeInvitationForFirm(
  firmId: string,
  invitationId: string,
): Promise<void> {
  await requireFirmOwner(firmId);
  const revoked = await revokeInvitationRow(db, { id: invitationId, firmId });
  if (!revoked) throw new InvitationNotFoundError();
}

export async function acceptInvitation(token: string): Promise<ClaimInvitationResult> {
  const user = await requireAuthenticatedUser();
  return claimInvitationRow(db, {
    token,
    userId: user.userId,
    userEmail: user.email,
  });
}
