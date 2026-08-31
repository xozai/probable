import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { getFirmMembership } from "../auth/firm-membership";
import { db } from "../db/client";
import { firmMembers, firms, firmSectionTemplates, users } from "../db/schema";
import { DEFAULT_SECTION_NAMES } from "../sections/defaults";

import { createFirmForUser } from "./repository";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("firm creation and membership", () => {
  const suffix = crypto.randomUUID();
  let userId = "";
  let outsiderId = "";
  let firmId = "";

  afterAll(async () => {
    if (firmId) await db.delete(firms).where(eq(firms.id, firmId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
    if (outsiderId) await db.delete(users).where(eq(users.id, outsiderId));
  });

  it("atomically creates a firm with the creator as owner", async () => {
    const [creator] = await db
      .insert(users)
      .values({ email: `creator-${suffix}@example.test` })
      .returning({ id: users.id });
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-${suffix}@example.test` })
      .returning({ id: users.id });
    if (!creator || !outsider) throw new Error("Test user creation failed");
    userId = creator.id;
    outsiderId = outsider.id;

    const firm = await createFirmForUser(userId, "  Oak Creek Civil  ");
    firmId = firm.id;

    expect(firm).toMatchObject({ name: "Oak Creek Civil", role: "owner" });
    await expect(getFirmMembership(userId, firmId)).resolves.toMatchObject({
      userId,
      firmId,
      role: "owner",
    });
    await expect(getFirmMembership(outsiderId, firmId)).resolves.toBeNull();
    await expect(
      db
        .select({ name: firmSectionTemplates.name })
        .from(firmSectionTemplates)
        .where(eq(firmSectionTemplates.firmId, firmId))
        .orderBy(firmSectionTemplates.sort),
    ).resolves.toEqual(DEFAULT_SECTION_NAMES.map((name) => ({ name })));
  });

  it("returns a member role without granting owner authority", async () => {
    await db.insert(firmMembers).values({
      firmId,
      userId: outsiderId,
      role: "member",
    });

    await expect(getFirmMembership(outsiderId, firmId)).resolves.toMatchObject({
      role: "member",
    });
    await expect(getFirmMembership(outsiderId, "not-a-uuid")).resolves.toBeNull();
  });
});
