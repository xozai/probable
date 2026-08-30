import { notFound, redirect } from "next/navigation";

import {
  FirmForbiddenError,
  FirmNotFoundError,
  UnauthorizedError,
} from "@/auth/authorization";
import { listInvitationsForFirm } from "@/invitations/service";

import styles from "../../workspace.module.css";
import { createInvitationAction, revokeInvitationAction } from "./actions";

function invitationStatus(invitation: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): "accepted" | "revoked" | "expired" | "pending" {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.revokedAt) return "revoked";
  if (invitation.expiresAt <= new Date()) return "expired";
  return "pending";
}

export default async function FirmInvitationsPage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = await params;
  let invitations;
  try {
    invitations = await listInvitationsForFirm(firmId);
  } catch (error) {
    if (error instanceof FirmNotFoundError) notFound();
    if (error instanceof FirmForbiddenError) {
      redirect(`/firms/${firmId}`);
    }
    if (error instanceof UnauthorizedError) {
      redirect(`/sign-in?callbackUrl=/firms/${firmId}/invitations`);
    }
    throw error;
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Firm workspace</p>
        <h1>Invitations</h1>

        {invitations.length > 0 ? (
          <ul className={styles.firmList}>
            {invitations.map((invitation) => {
              const status = invitationStatus(invitation);
              return (
                <li key={invitation.id}>
                  <span>
                    {invitation.email} — {status}
                  </span>
                  {status === "pending" ? (
                    <form
                      action={revokeInvitationAction.bind(
                        null,
                        firmId,
                        invitation.id,
                      )}
                    >
                      <button type="submit">Revoke</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No invitations sent yet.</p>
        )}

        <form
          action={createInvitationAction.bind(null, firmId)}
          className={styles.form}
        >
          <label htmlFor="invite-email">Invite by email</label>
          <input id="invite-email" name="email" type="email" required />
          <button type="submit">Send invite</button>
        </form>
      </section>
    </main>
  );
}
