import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "../db/client";
import { firmInvitations, firmMembers, firms, users } from "../db/schema";

import { claimInvitation, createInvitation, revokeInvitation } from "./repository";

/**
 * Exercises the invitation flow against a real Postgres, same convention as
 * src/db/schema.integration.test.ts: requires a migrated DATABASE_URL,
 * skipped otherwise so `npm test` stays hermetic.
 */
describe.skipIf(!process.env.DATABASE_URL)("invitations (integration)", () => {
  afterAll(async () => {
    await db.$client.end();
  });

  async function makeFirm(name: string) {
    const [firm] = await db.insert(firms).values({ name }).returning();
    if (!firm) throw new Error("insert did not return a row");
    return firm;
  }

  // randomUUID (not Date.now()) so emails can never collide with another
  // test file's own timestamp-based rows when vitest runs files in parallel
  // against the same database.
  async function makeUser(prefix: string) {
    const [user] = await db
      .insert(users)
      .values({ email: `${prefix}-${randomUUID()}@example.com` })
      .returning();
    if (!user) throw new Error("insert did not return a row");
    return user;
  }

  it("accepts a valid invitation exactly once and creates a member row", async () => {
    const firm = await makeFirm("Acme Civil");
    const owner = await makeUser("owner");
    const invitee = await makeUser("invitee");

    const invitation = await createInvitation(db, {
      firmId: firm.id,
      email: invitee.email,
      createdBy: owner.id,
    });

    const first = await claimInvitation(db, {
      token: invitation.token,
      userId: invitee.id,
      userEmail: invitee.email,
    });
    expect(first).toEqual({ ok: true, firmId: firm.id });

    const membership = await db.query.firmMembers.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.firmId, firm.id), eq(table.userId, invitee.id)),
    });
    expect(membership?.role).toBe("member");

    const replay = await claimInvitation(db, {
      token: invitation.token,
      userId: invitee.id,
      userEmail: invitee.email,
    });
    expect(replay).toEqual({ ok: false, reason: "already_accepted" });
  });

  it("rejects a token that does not exist", async () => {
    const someUser = await makeUser("nobody");
    const result = await claimInvitation(db, {
      token: "not-a-real-token",
      userId: someUser.id,
      userEmail: someUser.email,
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an expired invitation", async () => {
    const firm = await makeFirm("Expired Co");
    const owner = await makeUser("owner");
    const invitee = await makeUser("invitee-expired");

    const invitation = await createInvitation(db, {
      firmId: firm.id,
      email: invitee.email,
      createdBy: owner.id,
    });
    await db
      .update(firmInvitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(firmInvitations.id, invitation.id));

    const result = await claimInvitation(db, {
      token: invitation.token,
      userId: invitee.id,
      userEmail: invitee.email,
    });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a revoked invitation and revoke is idempotent/firm-scoped", async () => {
    const firm = await makeFirm("Revoked Co");
    const otherFirm = await makeFirm("Other Firm");
    const owner = await makeUser("owner");
    const invitee = await makeUser("invitee-revoked");

    const invitation = await createInvitation(db, {
      firmId: firm.id,
      email: invitee.email,
      createdBy: owner.id,
    });

    const wrongFirmRevoke = await revokeInvitation(db, {
      id: invitation.id,
      firmId: otherFirm.id,
    });
    expect(wrongFirmRevoke).toBe(false);

    const revoked = await revokeInvitation(db, { id: invitation.id, firmId: firm.id });
    expect(revoked).toBe(true);

    const secondRevoke = await revokeInvitation(db, { id: invitation.id, firmId: firm.id });
    expect(secondRevoke).toBe(false);

    const result = await claimInvitation(db, {
      token: invitation.token,
      userId: invitee.id,
      userEmail: invitee.email,
    });
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });

  it("rejects a claim from a user whose email does not match the invitation", async () => {
    const firm = await makeFirm("Mismatch Co");
    const owner = await makeUser("owner");
    const invitedEmail = `invited-${randomUUID()}@example.com`;
    const wrongUser = await makeUser("wrong");

    const invitation = await createInvitation(db, {
      firmId: firm.id,
      email: invitedEmail,
      createdBy: owner.id,
    });

    const result = await claimInvitation(db, {
      token: invitation.token,
      userId: wrongUser.id,
      userEmail: wrongUser.email,
    });
    expect(result).toEqual({ ok: false, reason: "email_mismatch" });
  });

  it("is idempotent for a user who is already a firm member", async () => {
    const firm = await makeFirm("Already Member Co");
    const owner = await makeUser("owner");
    const invitee = await makeUser("already");
    await db.insert(firmMembers).values({ firmId: firm.id, userId: invitee.id, role: "member" });

    const invitation = await createInvitation(db, {
      firmId: firm.id,
      email: invitee.email,
      createdBy: owner.id,
    });

    const result = await claimInvitation(db, {
      token: invitation.token,
      userId: invitee.id,
      userEmail: invitee.email,
    });
    expect(result).toEqual({ ok: true, firmId: firm.id });
  });
});
