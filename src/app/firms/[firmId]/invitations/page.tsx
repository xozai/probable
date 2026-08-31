import { notFound, redirect } from "next/navigation";

import { FlashCleanup } from "@/app/flash-cleanup";
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

// searchParams is client-visible/editable input, so `invited` is only ever
// rendered as a link if it is a same-origin /invite/<token> URL.
function sanitizeInvitedUrl(value: string | undefined): string | null {
  if (!value) return null;
  const configuredOrigin = process.env.AUTH_URL ?? "http://localhost:3000";
  try {
    const parsed = new URL(value, configuredOrigin);
    if (parsed.origin !== new URL(configuredOrigin).origin) return null;
    if (!parsed.pathname.startsWith("/invite/")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default async function FirmInvitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ firmId: string }>;
  searchParams: Promise<{ invited?: string; error?: string }>;
}) {
  const { firmId } = await params;
  const resolvedSearchParams = await searchParams;
  const invitedUrl = sanitizeInvitedUrl(resolvedSearchParams.invited);
  const errorMessage = resolvedSearchParams.error;
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
        <FlashCleanup active={Boolean(invitedUrl || errorMessage)} />
        <p className={styles.eyebrow}>Firm workspace</p>
        <h1>Invitations</h1>

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        {invitedUrl ? (
          <p>
            Invitation sent. Share this link (shown once — it is also emailed):{" "}
            <a href={invitedUrl}>{invitedUrl}</a>
          </p>
        ) : null}

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
