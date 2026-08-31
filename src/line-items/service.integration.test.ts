import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "../db/client";
import { estimates, firmMembers, firms, projects, users } from "../db/schema";

let allowedFirmId = "";
vi.mock("../auth/authorization", async () => {
  const policy = await vi.importActual<typeof import("../auth/authorization-policy")>("../auth/authorization-policy");
  return {
    ...policy,
    requireFirmMember: vi.fn(async (firmId: string) => {
      if (firmId !== allowedFirmId) throw new policy.FirmNotFoundError();
      return { userId: "test-user", email: "member@example.test", firmId, role: "member" as const };
    }),
  };
});

import { EstimateNotFoundError } from "../projects/service";
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
