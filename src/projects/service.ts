import { and, asc, eq } from "drizzle-orm";

import { FirmNotFoundError, isFirmId, requireFirmMember } from "../auth/authorization";
import { db } from "../db/client";
import { estimates, projects } from "../db/schema";
import type { EstimateInput, ProjectInput } from "./types";
import { validateEstimateInput, validateProjectInput } from "./validation";

export class ProjectNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

export class EstimateNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Estimate not found");
    this.name = "EstimateNotFoundError";
  }
}

export class DuplicateEstimateError extends Error {
  readonly status = 409;

  constructor() {
    super("That milestone and revision already exists for this project");
    this.name = "DuplicateEstimateError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

async function loadProjectForMember(projectId: string) {
  if (!isFirmId(projectId)) throw new ProjectNotFoundError();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new ProjectNotFoundError();
  try {
    await requireFirmMember(project.firmId);
  } catch (error) {
    if (error instanceof FirmNotFoundError) throw new ProjectNotFoundError();
    throw error;
  }
  return project;
}

async function loadEstimateForMember(estimateId: string) {
  if (!isFirmId(estimateId)) throw new EstimateNotFoundError();
  const [row] = await db
    .select({ estimate: estimates, project: projects })
    .from(estimates)
    .innerJoin(projects, eq(estimates.projectId, projects.id))
    .where(eq(estimates.id, estimateId))
    .limit(1);
  if (!row) throw new EstimateNotFoundError();
  try {
    await requireFirmMember(row.project.firmId);
  } catch (error) {
    if (error instanceof FirmNotFoundError) throw new EstimateNotFoundError();
    throw error;
  }
  return row;
}

export async function listProjects(firmId: string) {
  await requireFirmMember(firmId);
  return db.select().from(projects).where(eq(projects.firmId, firmId)).orderBy(asc(projects.name));
}

export async function createProject(firmId: string, input: ProjectInput) {
  await requireFirmMember(firmId);
  const values = validateProjectInput(input);
  const [project] = await db.insert(projects).values({ firmId, ...values }).returning();
  if (!project) throw new Error("Project insert did not return a row");
  return project;
}

export async function getProject(projectId: string) {
  const project = await loadProjectForMember(projectId);
  const projectEstimates = await db
    .select()
    .from(estimates)
    .where(eq(estimates.projectId, projectId))
    .orderBy(asc(estimates.milestone), asc(estimates.revision));
  return { ...project, estimates: projectEstimates };
}

export async function updateProject(projectId: string, input: ProjectInput) {
  await loadProjectForMember(projectId);
  const values = validateProjectInput(input);
  const [project] = await db.update(projects).set(values).where(eq(projects.id, projectId)).returning();
  if (!project) throw new ProjectNotFoundError();
  return project;
}

export async function createEstimate(projectId: string, input: EstimateInput) {
  await loadProjectForMember(projectId);
  const values = validateEstimateInput(input);
  try {
    const [estimate] = await db.insert(estimates).values({ projectId, ...values }).returning();
    if (!estimate) throw new Error("Estimate insert did not return a row");
    return estimate;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateEstimateError();
    throw error;
  }
}

export async function getEstimate(estimateId: string) {
  return loadEstimateForMember(estimateId);
}

export async function updateEstimate(estimateId: string, input: EstimateInput) {
  const { estimate } = await loadEstimateForMember(estimateId);
  const values = validateEstimateInput(input);
  try {
    const [updated] = await db
      .update(estimates)
      .set(values)
      .where(and(eq(estimates.id, estimateId), eq(estimates.projectId, estimate.projectId)))
      .returning();
    if (!updated) throw new EstimateNotFoundError();
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateEstimateError();
    throw error;
  }
}
