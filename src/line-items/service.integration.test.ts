import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "../db/client";
import {
  estimates,
  estimateSections,
  firmMembers,
  firms,
  projects,
  users,
} from "../db/schema";

let allowedFirmId = "";
vi.mock("../auth/authorization", async () => {
  const policy = await vi.importActual<typeof import("../auth/authorization-policy")>("../auth/authorization-policy");
  return {
    ...policy,
    requireAuthenticatedUser: vi.fn(async () => ({ userId: "test-user", email: "member@example.test" })),
    requireFirmMember: vi.fn(async (firmId: string) => {
      if (firmId !== allowedFirmId) throw new policy.FirmNotFoundError();
      return { userId: "test-user", email: "member@example.test", firmId, role: "member" as const };
    }),
  };
});

import { EstimateNotFoundError } from "../projects/service";
import { LineItemValidationError } from "./validation";
import {
  addLineItem,
  deleteLineItem,
  LineItemNotFoundError,
  listLineItems,
  pasteLineItems,
  PasteValidationError,
  reorderLineItems,
  updateLineItem,
} from "./service";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("line item manual and TSV-paste grid", () => {
  const suffix = crypto.randomUUID();
  let userId = "";
  let firstFirmId = "";
  let secondFirmId = "";
  let estimateId = "";
  let otherEstimateId = "";
  let estimateSectionId = "";
  let otherEstimateSectionId = "";

  beforeAll(async () => {
    const [user] = await db.insert(users).values({ email: `line-items-${suffix}@example.test` }).returning();
    if (!user) throw new Error("Test user creation failed");
    userId = user.id;

    const createdFirms = await db.insert(firms).values([{ name: "Allowed Firm" }, { name: "Other Firm" }]).returning();
    if (!createdFirms[0] || !createdFirms[1]) throw new Error("Test firm creation failed");
    firstFirmId = createdFirms[0].id;
    secondFirmId = createdFirms[1].id;
    allowedFirmId = firstFirmId;
    await db.insert(firmMembers).values({ firmId: firstFirmId, userId, role: "member" });

    const createdProjects = await db
      .insert(projects)
      .values([{ firmId: firstFirmId, name: "Roadway" }, { firmId: secondFirmId, name: "Secret" }])
      .returning();
    const project = createdProjects[0];
    const otherProject = createdProjects[1];
    if (!project || !otherProject) throw new Error("Test project creation failed");

    const createdEstimates = await db
      .insert(estimates)
      .values([
        { projectId: project.id, milestone: "30", revision: 1, contingencyPct: "10" },
        { projectId: otherProject.id, milestone: "30", revision: 1, contingencyPct: "10" },
      ])
      .returning();
    const estimate = createdEstimates[0];
    const otherEstimate = createdEstimates[1];
    if (!estimate || !otherEstimate) throw new Error("Test estimate creation failed");
    estimateId = estimate.id;
    otherEstimateId = otherEstimate.id;
    const createdSections = await db
      .insert(estimateSections)
      .values([
        { estimateId, name: "Earthwork", sort: 0 },
        { estimateId: otherEstimateId, name: "Secret", sort: 0 },
      ])
      .returning({ id: estimateSections.id });
    if (!createdSections[0] || !createdSections[1]) {
      throw new Error("Test section creation failed");
    }
    estimateSectionId = createdSections[0].id;
    otherEstimateSectionId = createdSections[1].id;
  });

  afterAll(async () => {
    if (firstFirmId) await db.delete(firms).where(eq(firms.id, firstFirmId));
    if (secondFirmId) await db.delete(firms).where(eq(firms.id, secondFirmId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("adds, edits, reorders, and deletes manual line items", async () => {
    const first = await addLineItem(estimateId, { description: "  Excavation  ", quantity: "120", unit: " CY " });
    expect(first).toMatchObject({ description: "Excavation", quantity: "120.000", unit: "CY", sort: 0 });

    const second = await addLineItem(estimateId, { description: "Base course", quantity: "340.5", unit: "SY" });
    expect(second.sort).toBe(1);

    const updated = await updateLineItem(estimateId, first.id, { description: "Excavation, rock", quantity: "125", unit: "CY" });
    expect(updated).toMatchObject({ description: "Excavation, rock", quantity: "125.000" });

    await reorderLineItems(estimateId, [second.id, first.id]);
    const ordered = await listLineItems(estimateId);
    expect(ordered.map((row) => row.id)).toEqual([second.id, first.id]);

    await deleteLineItem(estimateId, second.id);
    await expect(listLineItems(estimateId)).resolves.toEqual([expect.objectContaining({ id: first.id })]);

    await expect(updateLineItem(estimateId, second.id, { description: "x", quantity: "1", unit: "EA" })).rejects.toBeInstanceOf(
      LineItemNotFoundError,
    );
    await expect(deleteLineItem(estimateId, second.id)).rejects.toBeInstanceOf(LineItemNotFoundError);
  });

  it("#33 item 5: rejects a partial or duplicate reorder list instead of producing duplicate sort values", async () => {
    const first = await addLineItem(estimateId, { description: "Reorder A", quantity: "1", unit: "EA" });
    await addLineItem(estimateId, { description: "Reorder B", quantity: "1", unit: "EA" });
    const before = await listLineItems(estimateId);

    // Partial: omits every other existing row in this estimate.
    await expect(reorderLineItems(estimateId, [first.id])).rejects.toBeInstanceOf(LineItemValidationError);
    // Duplicate: same id twice, still short of the full set.
    await expect(reorderLineItems(estimateId, [first.id, first.id])).rejects.toBeInstanceOf(
      LineItemValidationError,
    );

    // Rejected reorders must not have touched sort or row identity.
    const after = await listLineItems(estimateId);
    expect(after).toEqual(before);
    expect(after.map((row) => row.sort)).toEqual([...new Set(after.map((row) => row.sort))]);
  });

  it("persists manual prices and only sections from the same estimate", async () => {
    const created = await addLineItem(estimateId, {
      description: "Priced excavation",
      quantity: "2.5",
      unit: "CY",
      unitPrice: "12.34",
      sectionId: estimateSectionId,
    });
    expect(created).toMatchObject({
      sectionId: estimateSectionId,
      unitPrice: "12.34",
      priceSource: "manual",
      matchStatus: "manual",
    });

    const beforeInvalidAdd = await listLineItems(estimateId);
    await expect(
      addLineItem(estimateId, {
        description: "Cross-estimate section",
        quantity: "1",
        unit: "EA",
        unitPrice: "1.00",
        sectionId: otherEstimateSectionId,
      }),
    ).rejects.toMatchObject({ message: "Section is not part of this estimate" });
    await expect(listLineItems(estimateId)).resolves.toHaveLength(
      beforeInvalidAdd.length,
    );

    await expect(
      updateLineItem(estimateId, created.id, {
        description: created.description,
        quantity: created.quantity,
        unit: created.unit,
        unitPrice: created.unitPrice,
        sectionId: otherEstimateSectionId,
      }),
    ).rejects.toMatchObject({ message: "Section is not part of this estimate" });
    await expect(listLineItems(estimateId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          sectionId: estimateSectionId,
        }),
      ]),
    );
  });

  it("creates exactly the pasted rows on a valid TSV paste (T-AC3-01)", async () => {
    const project = await db.insert(projects).values({ firmId: firstFirmId, name: "Paste target" }).returning();
    const [freshProject] = project;
    if (!freshProject) throw new Error("project creation failed");
    const [freshEstimate] = await db
      .insert(estimates)
      .values({ projectId: freshProject.id, milestone: "60", revision: 1, contingencyPct: "5" })
      .returning();
    if (!freshEstimate) throw new Error("estimate creation failed");

    const text = [
      "Excavation\t120\tCY",
      "Base course\t340.5\tSY",
      "Curb\t500\tLF",
      "Storm pipe\t210\tLF",
      "Manhole\t4\tEA",
    ].join("\n");

    const created = await pasteLineItems(freshEstimate.id, text);
    expect(created).toHaveLength(5);
    const listed = await listLineItems(freshEstimate.id);
    expect(listed).toHaveLength(5);
    expect(listed[0]).toMatchObject({ description: "Excavation", quantity: "120.000", unit: "CY" });
  });

  it("persists nothing when a pasted batch has invalid rows, then commits after correction (T-AC3-02)", async () => {
    const [freshProject] = await db.insert(projects).values({ firmId: firstFirmId, name: "Paste target 2" }).returning();
    if (!freshProject) throw new Error("project creation failed");
    const [freshEstimate] = await db
      .insert(estimates)
      .values({ projectId: freshProject.id, milestone: "60", revision: 1, contingencyPct: "5" })
      .returning();
    if (!freshEstimate) throw new Error("estimate creation failed");

    const badText = [
      "Excavation\t120\tCY",
      "Base course\tabc\tSY",
      "Curb\t500\tLF",
      "Storm pipe\t-1\tLF",
      "Manhole\t4\tEA",
    ].join("\n");

    const error = await pasteLineItems(freshEstimate.id, badText).catch((e) => e);
    expect(error).toBeInstanceOf(PasteValidationError);
    expect((error as PasteValidationError).rowErrors.map((e) => e.index)).toEqual([1, 3]);
    await expect(listLineItems(freshEstimate.id)).resolves.toEqual([]);

    const fixedText = ["Excavation\t120\tCY", "Curb\t500\tLF", "Manhole\t4\tEA"].join("\n");
    const created = await pasteLineItems(freshEstimate.id, fixedText);
    expect(created).toHaveLength(3);
    await expect(listLineItems(freshEstimate.id)).resolves.toHaveLength(3);
  });

  it("maps missing, malformed, and cross-firm resources to not found", async () => {
    await expect(listLineItems(otherEstimateId)).rejects.toBeInstanceOf(EstimateNotFoundError);
    await expect(listLineItems("not-a-uuid")).rejects.toBeInstanceOf(EstimateNotFoundError);
    await expect(listLineItems(crypto.randomUUID())).rejects.toBeInstanceOf(EstimateNotFoundError);
    await expect(addLineItem(otherEstimateId, { description: "x", quantity: "1", unit: "EA" })).rejects.toBeInstanceOf(
      EstimateNotFoundError,
    );
  });
});
