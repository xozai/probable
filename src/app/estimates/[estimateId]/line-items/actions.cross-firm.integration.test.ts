import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "../../../../db/client";
import { estimates, firmMembers, firms, lineItems, projects, users } from "../../../../db/schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Same pattern as ./actions.integration.test.ts: mock requireFirmMember so
// the caller is authenticated as a member of `allowedFirmId` only, then hit
// every action in ./actions against a *real* estimateId belonging to a
// second firm the caller is not a member of. This closes the gap the
// existing actions.integration.test.ts leaves open: it only proves a forged
// sectionId is ignored on the *same* estimate, never that firm A can't
// touch firm B's estimate via its real id.
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

import {
  addLineItemAction,
  deleteLineItemAction,
  listLineItemsAction,
  pasteLineItemsAction,
  reorderLineItemsAction,
  updateLineItemAction,
} from "./actions";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("line-item server actions reject a real cross-firm estimateId", () => {
  const suffix = crypto.randomUUID();

  let userAId = "";
  let firmAId = "";
  let firmBId = "";
  let userBId = "";
  let otherEstimateId = "";
  let otherLineItemId = "";
  let otherLineItemSnapshot: (typeof lineItems.$inferSelect) | undefined;

  beforeAll(async () => {
    // Firm A: the authenticated caller's own firm (allowed).
    const [userA] = await db
      .insert(users)
      .values({ email: `cross-firm-a-${suffix}@example.test` })
      .returning();
    if (!userA) throw new Error("Test user A creation failed");
    userAId = userA.id;

    const [firmA] = await db.insert(firms).values({ name: "Firm A (allowed)" }).returning();
    if (!firmA) throw new Error("Test firm A creation failed");
    firmAId = firmA.id;
    allowedFirmId = firmAId;
    await db.insert(firmMembers).values({ firmId: firmAId, userId: userAId, role: "member" });

    // Firm B: a separate tenant with its own estimate and one persisted line
    // item, which the firm-A caller must never be able to read/mutate.
    const [userB] = await db
      .insert(users)
      .values({ email: `cross-firm-b-${suffix}@example.test` })
      .returning();
    if (!userB) throw new Error("Test user B creation failed");
    userBId = userB.id;

    const [firmB] = await db.insert(firms).values({ name: "Firm B (not a member)" }).returning();
    if (!firmB) throw new Error("Test firm B creation failed");
    firmBId = firmB.id;
    await db.insert(firmMembers).values({ firmId: firmBId, userId: userBId, role: "owner" });

    const [projectB] = await db
      .insert(projects)
      .values({ firmId: firmBId, name: "Firm B Roadway" })
      .returning();
    if (!projectB) throw new Error("Test project B creation failed");

    const [estimateB] = await db
      .insert(estimates)
      .values({ projectId: projectB.id, milestone: "30", revision: 1, contingencyPct: "10" })
      .returning();
    if (!estimateB) throw new Error("Test estimate B creation failed");
    otherEstimateId = estimateB.id;

    // Insert firm B's line item directly via the real service, while
    // temporarily posing as a firm-B member, so it's a real, fully-formed
    // row (with its own cost_items row) rather than a hand-crafted insert
    // that might not match production shape.
    const previousAllowed = allowedFirmId;
    allowedFirmId = firmBId;
    const created = await addLineItemAction(otherEstimateId, {
      description: "Firm B curb and gutter",
      quantity: "100",
      unit: "LF",
    });
    allowedFirmId = previousAllowed;
    if (!created.ok) throw new Error("Failed to seed firm B's line item for the test");
    otherLineItemId = created.data.id;

    const [snapshot] = await db.select().from(lineItems).where(eq(lineItems.id, otherLineItemId));
    if (!snapshot) throw new Error("Failed to load firm B's seeded line item");
    otherLineItemSnapshot = snapshot;
  });

  afterAll(async () => {
    if (firmAId) await db.delete(firms).where(eq(firms.id, firmAId));
    if (firmBId) await db.delete(firms).where(eq(firms.id, firmBId));
    if (userAId) await db.delete(users).where(eq(users.id, userAId));
    if (userBId) await db.delete(users).where(eq(users.id, userBId));
  });

  async function countLineItemsForOtherEstimate(): Promise<number> {
    const rows = await db.select().from(lineItems).where(eq(lineItems.estimateId, otherEstimateId));
    return rows.length;
  }

  async function loadOtherLineItem() {
    const [row] = await db.select().from(lineItems).where(eq(lineItems.id, otherLineItemId));
    return row ?? null;
  }

  it("listLineItemsAction: does not return firm B's line items to a firm-A caller", async () => {
    const result = await listLineItemsAction(otherEstimateId);
    expect(result.ok).toBe(false);
  });

  it("addLineItemAction: does not let a firm-A caller create a row on firm B's estimate", async () => {
    const before = await countLineItemsForOtherEstimate();

    const result = await addLineItemAction(otherEstimateId, {
      description: "Forged firm-A add",
      quantity: "5",
      unit: "EA",
    });
    expect(result.ok).toBe(false);

    const after = await countLineItemsForOtherEstimate();
    expect(after).toBe(before);
  });

  it("updateLineItemAction: does not let a firm-A caller mutate firm B's line item", async () => {
    const result = await updateLineItemAction(otherEstimateId, otherLineItemId, {
      description: "Hijacked description",
      quantity: "999",
      unit: "HJ",
    });
    expect(result.ok).toBe(false);

    const current = await loadOtherLineItem();
    expect(current).toEqual(otherLineItemSnapshot);
  });

  it("deleteLineItemAction: does not let a firm-A caller delete firm B's line item", async () => {
    const result = await deleteLineItemAction(otherEstimateId, otherLineItemId);
    expect(result.ok).toBe(false);

    const current = await loadOtherLineItem();
    expect(current).not.toBeNull();
    expect(current).toEqual(otherLineItemSnapshot);
  });

  it("pasteLineItemsAction: does not let a firm-A caller paste rows into firm B's estimate", async () => {
    const before = await countLineItemsForOtherEstimate();

    const result = await pasteLineItemsAction(otherEstimateId, "Forged paste row\t1\tEA");
    expect(result.ok).toBe(false);

    const after = await countLineItemsForOtherEstimate();
    expect(after).toBe(before);
  });

  it("reorderLineItemsAction: does not let a firm-A caller reorder firm B's line items", async () => {
    const result = await reorderLineItemsAction(otherEstimateId, [otherLineItemId]);
    expect(result.ok).toBe(false);

    const current = await loadOtherLineItem();
    expect(current?.sort).toBe(otherLineItemSnapshot?.sort);
  });
});
