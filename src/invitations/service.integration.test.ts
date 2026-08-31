import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("./mailer", () => ({ sendInvitationEmail: vi.fn() }));

import { auth } from "../auth";
import { db } from "../db/client";
import { FirmForbiddenError } from "../auth/authorization-policy";
import { firmInvitations, firmMembers, firms, users } from "../db/schema";

import { sendInvitationEmail } from "./mailer";
import { InvitationEmailError } from "./errors";
import { createInvitation as createInvitationRow } from "./repository";
import {
  createInvitationForFirm,
  listInvitationsForFirm,
  revokeInvitationForFirm,
} from "./service";

/**
 * Exercises the same server-action entry points
 * (src/app/firms/[firmId]/invitations/actions.ts) call directly, against a
 * real Postgres, same convention as ./repository.integration.test.ts. A
 * fake `auth()` session stands in for the magic-link cookie so the real
 * `requireFirmOwner` guard runs unmodified against real firm_members rows.
 */
describe.skipIf(!process.env.DATABASE_URL)("invitations service (integration)", () => {
  afterAll(async () => {
    await db.$client.end();
  });

  function mockSessionEmail(email: string): void {
    vi.mocked(auth).mockResolvedValue({
      user: { email },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  async function makeFirmWithOwnerAndMember() {
    const [firm] = await db.insert(firms).values({ name: "Member Forbidden Co" }).returning();
    if (!firm) throw new Error("insert did not return a row");
    const [owner] = await db
      .insert(users)
      .values({ email: `owner-${randomUUID()}@example.com` })
      .returning();
    const [member] = await db
      .insert(users)
      .values({ email: `member-${randomUUID()}@example.com` })
      .returning();
    if (!owner || !member) throw new Error("insert did not return a row");
    await db.insert(firmMembers).values([
      { firmId: firm.id, userId: owner.id, role: "owner" },
      { firmId: firm.id, userId: member.id, role: "member" },
    ]);
    return { firm, owner, member };
  }

  it("T-AC1-07 (server action layer): a member cannot create an invitation", async () => {
    const { firm, member } = await makeFirmWithOwnerAndMember();
    mockSessionEmail(member.email);

    await expect(
      createInvitationForFirm(firm.id, `target-${randomUUID()}@example.com`),
    ).rejects.toBeInstanceOf(FirmForbiddenError);

    const rows = await db
      .select()
      .from(firmInvitations)
      .where(eq(firmInvitations.firmId, firm.id));
    expect(rows).toHaveLength(0);
  });

  it("T-AC1-07 (server action layer): a member cannot revoke an existing invitation", async () => {
    const { firm, owner, member } = await makeFirmWithOwnerAndMember();
    const invitation = await createInvitationRow(db, {
      firmId: firm.id,
      email: `target-${randomUUID()}@example.com`,
      createdBy: owner.id,
    });

    mockSessionEmail(member.email);

    await expect(revokeInvitationForFirm(firm.id, invitation.id)).rejects.toBeInstanceOf(
      FirmForbiddenError,
    );

    const [row] = await db
      .select({ revokedAt: firmInvitations.revokedAt })
      .from(firmInvitations)
      .where(eq(firmInvitations.id, invitation.id));
    expect(row?.revokedAt).toBeNull();
  });

  it("T-AC1-07 (server action layer): a member cannot list invitations either", async () => {
    const { firm, member } = await makeFirmWithOwnerAndMember();
    mockSessionEmail(member.email);

    await expect(listInvitationsForFirm(firm.id)).rejects.toBeInstanceOf(FirmForbiddenError);
  });

  it("#33 item 3: surfaces an email-send failure instead of a raw 500, leaving the pending invitation revokable", async () => {
    const { firm, owner } = await makeFirmWithOwnerAndMember();
    mockSessionEmail(owner.email);
    vi.mocked(sendInvitationEmail).mockRejectedValueOnce(new Error("Resend error"));

    const targetEmail = `target-${randomUUID()}@example.com`;
    await expect(createInvitationForFirm(firm.id, targetEmail)).rejects.toBeInstanceOf(
      InvitationEmailError,
    );

    // The invitation row is already committed (see the service's comment on
    // this ordering); the owner can see and revoke it from the list.
    const rows = await db
      .select({ email: firmInvitations.email, revokedAt: firmInvitations.revokedAt })
      .from(firmInvitations)
      .where(eq(firmInvitations.firmId, firm.id));
    expect(rows).toEqual([expect.objectContaining({ email: targetEmail, revokedAt: null })]);
  });
});
