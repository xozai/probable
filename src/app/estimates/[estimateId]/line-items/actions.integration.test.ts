import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "../../../../db/client";
import { estimates, firmMembers, firms, projects, users } from "../../../../db/schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let allowedFirmId = "";
vi.mock("../../../../auth/authorization", async () => {
  const policy = await vi.importActual<typeof import("../../../../auth/authorization-policy")>(
    "../../../../auth/authorization-policy",
  );
  return {
    ...policy,
    requireFirmMember: vi.fn(async (firmId: string) => {
      if (firmId !== allowedFirmId) throw new policy.FirmNotFoundError();
      return { userId: "test-user", email: "member@example.test", firmId, role: "member" as const };
    }),
  };
});

import { addLineItemAction, updateLineItemAction } from "./actions";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("line-item server actions reject client-supplied sectionId", () => {
  const suffix = crypto.randomUUID();
  let userId = "";
  let firmId = "";
  let estimateId = "";
  let otherEstimateSectionId = "";

  beforeAll(async () => {
    const [user] = await db.insert(users).values({ email: `line-item-actions-${suffix}@example.test` }).returning();
    if (!user) throw new Error("Test user creation failed");
    userId = user.id;

    const [firm] = await db.insert(firms).values({ name: "Line Item Actions Firm" }).returning();
    if (!firm) throw new Error("Test firm creation failed");
    firmId = firm.id;
    allowedFirmId = firmId;
    await db.insert(firmMembers).values({ firmId, userId, role: "member" });

    const [project] = await db.insert(projects).values({ firmId, name: "Roadway" }).returning();
    if (!project) throw new Error("Test project creation failed");

    const [estimate] = await db
      .insert(estimates)
      .values({ projectId: project.id, milestone: "30", revision: 1, contingencyPct: "10" })
      .returning();
    if (!estimate) throw new Error("Test estimate creation failed");
    estimateId = estimate.id;

    // A UUID that resolves to a real estimate_sections-shaped row via a
    // different, unrelated estimate would require #10's tables; a random
    // UUID is sufficient here since the attack is "does this field flow
    // through at all", not "does the FK accept it".
    otherEstimateSectionId = crypto.randomUUID();
  });

  afterAll(async () => {
    if (firmId) await db.delete(firms).where(eq(firms.id, firmId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("ignores a forged sectionId on add, regardless of the TypeScript input type", async () => {
    const forgedInput = {
      description: "Excavation",
      quantity: "120",
      unit: "CY",
      sectionId: otherEstimateSectionId,
    } as unknown as { description: string; quantity: string; unit: string };

    const result = await addLineItemAction(estimateId, forgedInput);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.sectionId).toBeNull();
  });

  it("ignores a forged sectionId on update, regardless of the TypeScript input type", async () => {
    const created = await addLineItemAction(estimateId, { description: "Base course", quantity: "10", unit: "SY" });
    if (!created.ok) throw new Error("expected success");

    const forgedInput = {
      description: "Base course, revised",
      quantity: "12",
      unit: "SY",
      sectionId: otherEstimateSectionId,
    } as unknown as { description: string; quantity: string; unit: string };

    const result = await updateLineItemAction(estimateId, created.data.id, forgedInput);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.sectionId).toBeNull();
  });
});
