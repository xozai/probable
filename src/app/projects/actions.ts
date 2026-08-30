"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createEstimate, createProject, updateEstimate, updateProject } from "@/projects/service";
import type { EstimateMilestone } from "@/projects/types";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createProjectAction(firmId: string, formData: FormData): Promise<void> {
  const project = await createProject(firmId, {
    name: text(formData, "name"),
    location: text(formData, "location"),
    district: text(formData, "district"),
  });
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData): Promise<void> {
  const project = await updateProject(projectId, {
    name: text(formData, "name"),
    location: text(formData, "location"),
    district: text(formData, "district"),
  });
  revalidatePath(`/projects/${project.id}`);
}

export async function createEstimateAction(projectId: string, formData: FormData): Promise<void> {
  const estimate = await createEstimate(projectId, {
    milestone: text(formData, "milestone") as EstimateMilestone,
    revision: Number(text(formData, "revision")),
    label: text(formData, "label"),
    contingencyPct: text(formData, "contingencyPct"),
  });
  redirect(`/estimates/${estimate.id}`);
}

export async function updateEstimateAction(estimateId: string, formData: FormData): Promise<void> {
  const estimate = await updateEstimate(estimateId, {
    milestone: text(formData, "milestone") as EstimateMilestone,
    revision: Number(text(formData, "revision")),
    label: text(formData, "label"),
    contingencyPct: text(formData, "contingencyPct"),
  });
  revalidatePath(`/estimates/${estimate.id}`);
  revalidatePath(`/projects/${estimate.projectId}`);
}
