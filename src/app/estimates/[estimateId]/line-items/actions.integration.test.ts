import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "../../../../db/client";
import {
  estimates,
  estimateSections,
  firmMembers,
  firms,
  projects,
  users,
} from "../../../../db/schema";

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

describeWithDatabase("line-item server actions validate section assignment", () => {
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

    const [otherEstimate] = await db
      .insert(estimates)
      .values({ projectId: project.id, milestone: "60", revision: 1, contingencyPct: "10" })
      .returning();
    if (!otherEstimate) throw new Error("Other estimate creation failed");
    const [otherSection] = await db
      .insert(estimateSections)
      .values({ estimateId: otherEstimate.id, name: "Other estimate section", sort: 0 })
      .returning();
    if (!otherSection) throw new Error("Other estimate section creation failed");
    otherEstimateSectionId = otherSection.id;
  });

  afterAll(async () => {
    if (firmId) await db.delete(firms).where(eq(firms.id, firmId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("rejects a section from another estimate on add", async () => {
    const result = await addLineItemAction(estimateId, {
      description: "Excavation",
      quantity: "120",
      unit: "CY",
      sectionId: otherEstimateSectionId,
    });
    expect(result).toEqual({
      ok: false,
      error: "Section is not part of this estimate",
    });
  });

  it("rejects a section from another estimate on update without mutating the row", async () => {
    const created = await addLineItemAction(estimateId, { description: "Base course", quantity: "10", unit: "SY" });
    if (!created.ok) throw new Error("expected success");

    const result = await updateLineItemAction(estimateId, created.data.id, {
      description: "Base course, revised",
      quantity: "12",
      unit: "SY",
      sectionId: otherEstimateSectionId,
    });
    expect(result).toEqual({
      ok: false,
      error: "Section is not part of this estimate",
    });

    const listed = await import("../../../../line-items/service").then(({ listLineItems }) =>
      listLineItems(estimateId),
    );
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.data.id, sectionId: null }),
      ]),
    );
  });
});
