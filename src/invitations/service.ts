import { and, eq, gt, isNull, sql } from "drizzle-orm";

import type { db as Database } from "../db/client";
import { firmInvitations, firmMembers } from "../db/schema";
import { normalizeEmail } from "../auth/email-policy";

import { generateInvitationToken, hashInvitationToken } from "./tokens";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreatedInvitation {
  id: string;
  token: string;
  expiresAt: Date;
}

export async function createInvitation(
  database: typeof Database,
  params: { firmId: string; email: string; createdBy: string },
): Promise<CreatedInvitation> {
  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const [row] = await database
    .insert(firmInvitations)
    .values({
      firmId: params.firmId,
      email: normalizeEmail(params.email),
      tokenHash,
      expiresAt,
      createdBy: params.createdBy,
    })
    .returning({ id: firmInvitations.id });

  if (!row) throw new Error("invitation insert did not return a row");
  return { id: row.id, token, expiresAt };
}

// Scoped by firmId as defense in depth alongside the owner-only authz guard:
// a direct-ID revoke for another firm's invitation silently no-ops (returns
// false) instead of mutating or revealing that the row exists.
export async function revokeInvitation(
  database: typeof Database,
  params: { id: string; firmId: string },
): Promise<boolean> {
  const result = await database
    .update(firmInvitations)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(firmInvitations.id, params.id),
        eq(firmInvitations.firmId, params.firmId),
        isNull(firmInvitations.acceptedAt),
        isNull(firmInvitations.revokedAt),
      ),
    )
    .returning({ id: firmInvitations.id });

  return result.length > 0;
}

export type ClaimInvitationResult =
  | { ok: true; firmId: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "expired"
        | "revoked"
        | "already_accepted"
        | "email_mismatch";
    };

export async function claimInvitation(
  database: typeof Database,
  params: { token: string; userId: string; userEmail: string },
): Promise<ClaimInvitationResult> {
  const tokenHash = hashInvitationToken(params.token);
  const email = normalizeEmail(params.userEmail);

  return database.transaction(async (tx) => {
    // Single atomic UPDATE is the source of truth for success: every
    // single-use/expiry/revoked/email-bound condition is in the WHERE
    // clause, so a concurrent replay of the same token cannot both succeed.
    const [claimed] = await tx
      .update(firmInvitations)
      .set({ acceptedAt: sql`now()` })
      .where(
        and(
          eq(firmInvitations.tokenHash, tokenHash),
          eq(firmInvitations.email, email),
          isNull(firmInvitations.acceptedAt),
          isNull(firmInvitations.revokedAt),
          gt(firmInvitations.expiresAt, sql`now()`),
        ),
      )
      .returning({ firmId: firmInvitations.firmId });

    if (!claimed) {
      // The claim failed; this lookup is only to produce an accurate error
      // message and is not a security boundary — the token itself is the
      // secret, so reflecting invitation state back to its holder leaks
      // nothing a tenant-isolation guard needs to hide.
      const [existing] = await tx
        .select({
          email: firmInvitations.email,
          acceptedAt: firmInvitations.acceptedAt,
          revokedAt: firmInvitations.revokedAt,
          expiresAt: firmInvitations.expiresAt,
        })
        .from(firmInvitations)
        .where(eq(firmInvitations.tokenHash, tokenHash));

      if (!existing) return { ok: false, reason: "not_found" };
      if (existing.email !== email) return { ok: false, reason: "email_mismatch" };
      if (existing.revokedAt) return { ok: false, reason: "revoked" };
      if (existing.acceptedAt) return { ok: false, reason: "already_accepted" };
      if (existing.expiresAt <= new Date()) return { ok: false, reason: "expired" };
      return { ok: false, reason: "not_found" };
    }

    // Idempotent: a re-invited user who is already a member claims the
    // invitation (single-use is still enforced above) without a duplicate
    // firm_members row.
    await tx
      .insert(firmMembers)
      .values({ firmId: claimed.firmId, userId: params.userId, role: "member" })
      .onConflictDoNothing();

    return { ok: true, firmId: claimed.firmId };
  });
}
