import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { FirmNotFoundError } from "../auth/authorization-policy";
import { db } from "../db/client";
import { firmMembers, firms, firmSectionTemplates, users } from "../db/schema";

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
    requireFirmOwner: vi.fn(async (firmId: string) => {
      if (firmId !== allowedFirmId) throw new policy.FirmNotFoundError();
      return { userId: "test-user", email: "owner@example.test", firmId, role: "owner" as const };
    }),
  };
});

import {
  listEstimateSections,
  listFirmSectionTemplates,
  replaceFirmSectionTemplates,
} from "../sections/service";

import {
  createEstimate,
  createProject,
  DuplicateEstimateError,
  EstimateNotFoundError,
  getEstimate,
  getProject,
  listProjects,
  ProjectNotFoundError,
  updateEstimate,
  updateProject,
} from "./service";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("project and estimate CRUD", () => {
  const suffix = crypto.randomUUID();
  let userId = "";
  let firstFirmId = "";
  let secondFirmId = "";

  beforeAll(async () => {
    const [user] = await db.insert(users).values({ email: `projects-${suffix}@example.test` }).returning();
    if (!user) throw new Error("Test user creation failed");
    userId = user.id;
    const createdFirms = await db.insert(firms).values([{ name: "Allowed Firm" }, { name: "Other Firm" }]).returning();
    if (!createdFirms[0] || !createdFirms[1]) throw new Error("Test firm creation failed");
    firstFirmId = createdFirms[0].id;
    secondFirmId = createdFirms[1].id;
    allowedFirmId = firstFirmId;
    await db.insert(firmMembers).values({ firmId: firstFirmId, userId, role: "member" });
  });

  afterAll(async () => {
    if (firstFirmId) await db.delete(firms).where(eq(firms.id, firstFirmId));
    if (secondFirmId) await db.delete(firms).where(eq(firms.id, secondFirmId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("creates, lists, reads, and edits projects inside the authorized firm", async () => {
    const project = await createProject(firstFirmId, { name: "  Lift Station  ", district: "  12  " });
    expect(project).toMatchObject({ name: "Lift Station", district: "12", firmId: firstFirmId });
    await expect(listProjects(firstFirmId)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id })]));
    await expect(updateProject(project.id, { name: "Lift Station Rehab", location: "Austin" })).resolves.toMatchObject({
      name: "Lift Station Rehab",
      location: "Austin",
    });
    await expect(getProject(project.id)).resolves.toMatchObject({ id: project.id, estimates: [] });
  });

  it("enforces unique milestone/revision pairs and permits another revision", async () => {
    const project = await createProject(firstFirmId, { name: "Roadway" });
    const first = await createEstimate(project.id, { milestone: "30", revision: 1, contingencyPct: "10" });
    await expect(createEstimate(project.id, { milestone: "30", revision: 1, contingencyPct: "5" })).rejects.toBeInstanceOf(DuplicateEstimateError);
    const second = await createEstimate(project.id, { milestone: "30", revision: 2, contingencyPct: "8.5" });
    expect(second.revision).toBe(2);
    await expect(updateEstimate(second.id, { milestone: "60", revision: 1, label: "Issued", contingencyPct: "9" })).resolves.toMatchObject({ milestone: "60", label: "Issued" });
    await expect(getEstimate(first.id)).resolves.toMatchObject({ project: { id: project.id }, estimate: { id: first.id } });
  });

  it("snapshots ordered firm defaults without mutating existing estimates", async () => {
    await db.insert(firmSectionTemplates).values([
      { firmId: firstFirmId, name: "Earthwork", sort: 0 },
      { firmId: firstFirmId, name: "Paving", sort: 1 },
    ]);
    const project = await createProject(firstFirmId, { name: "Snapshot project" });
    const first = await createEstimate(project.id, {
      milestone: "30",
      revision: 1,
      contingencyPct: "10",
    });

    await expect(listEstimateSections(first.id)).resolves.toMatchObject([
      { estimateId: first.id, name: "Earthwork", sort: 0 },
      { estimateId: first.id, name: "Paving", sort: 1 },
    ]);

    await replaceFirmSectionTemplates(firstFirmId, ["Structures", "Drainage"]);
    await expect(listFirmSectionTemplates(firstFirmId)).resolves.toMatchObject([
      { firmId: firstFirmId, name: "Structures", sort: 0 },
      { firmId: firstFirmId, name: "Drainage", sort: 1 },
    ]);
    await expect(listEstimateSections(first.id)).resolves.toMatchObject([
      { estimateId: first.id, name: "Earthwork", sort: 0 },
      { estimateId: first.id, name: "Paving", sort: 1 },
    ]);

    const second = await createEstimate(project.id, {
      milestone: "60",
      revision: 1,
      contingencyPct: "10",
    });
    await expect(listEstimateSections(second.id)).resolves.toMatchObject([
      { estimateId: second.id, name: "Structures", sort: 0 },
      { estimateId: second.id, name: "Drainage", sort: 1 },
    ]);
  });

  it("maps missing, malformed, and cross-firm resources to not found", async () => {
    const [otherProject] = await db.insert((await import("../db/schema")).projects).values({ firmId: secondFirmId, name: "Secret" }).returning();
    if (!otherProject) throw new Error("Other project creation failed");
    await expect(getProject(otherProject.id)).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(getProject("not-a-uuid")).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(getEstimate(crypto.randomUUID())).rejects.toBeInstanceOf(EstimateNotFoundError);
    await expect(listProjects(secondFirmId)).rejects.toBeInstanceOf(FirmNotFoundError);
  });

  // T-AC9-02: a cross-firm *mutation* (not just a read) must also 404 and
  // must leave the other firm's resource byte-for-byte unchanged.
  it("rejects cross-firm mutations to a project or estimate and leaves them unchanged", async () => {
    const { projects: projectsTable, estimates: estimatesTable } = await import("../db/schema");

    const [otherProject] = await db
      .insert(projectsTable)
      .values({ firmId: secondFirmId, name: "Other Firm's Secret Project", location: "Dallas" })
      .returning();
    if (!otherProject) throw new Error("Other project creation failed");

    const [otherEstimate] = await db
      .insert(estimatesTable)
      .values({ projectId: otherProject.id, milestone: "30", revision: 1, contingencyPct: "10" })
      .returning();
    if (!otherEstimate) throw new Error("Other estimate creation failed");

    await expect(
      updateProject(otherProject.id, { name: "Hijacked Name", location: "Austin" }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);

    await expect(
      updateEstimate(otherEstimate.id, {
        milestone: "60",
        revision: 1,
        label: "Hijacked",
        contingencyPct: "99",
      }),
    ).rejects.toBeInstanceOf(EstimateNotFoundError);

    const [reloadedProject] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, otherProject.id));
    expect(reloadedProject).toMatchObject({
      name: "Other Firm's Secret Project",
      location: "Dallas",
    });

    const [reloadedEstimate] = await db
      .select()
      .from(estimatesTable)
      .where(eq(estimatesTable.id, otherEstimate.id));
    expect(reloadedEstimate).toMatchObject({
      milestone: "30",
      revision: 1,
      label: null,
      contingencyPct: "10.00",
    });
  });
});
