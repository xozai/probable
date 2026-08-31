"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withErrorFlash } from "@/app/error-flash";
import {
  createEstimate,
  createProject,
  DuplicateEstimateError,
  ProjectValidationError,
  updateEstimate,
  updateProject,
} from "@/projects/service";
import type { EstimateMilestone } from "@/projects/types";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createProjectAction(firmId: string, formData: FormData): Promise<void> {
  let project;
  try {
    project = await createProject(firmId, {
      name: text(formData, "name"),
      location: text(formData, "location"),
      district: text(formData, "district"),
    });
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      redirect(withErrorFlash(`/firms/${firmId}`, error.message));
    }
    throw error;
  }
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData): Promise<void> {
  let project;
  try {
    project = await updateProject(projectId, {
      name: text(formData, "name"),
      location: text(formData, "location"),
      district: text(formData, "district"),
    });
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      redirect(withErrorFlash(`/projects/${projectId}`, error.message));
    }
    throw error;
  }
  revalidatePath(`/projects/${project.id}`);
}

export async function createEstimateAction(projectId: string, formData: FormData): Promise<void> {
  let estimate;
  try {
    estimate = await createEstimate(projectId, {
      milestone: text(formData, "milestone") as EstimateMilestone,
      revision: Number(text(formData, "revision")),
      label: text(formData, "label"),
      contingencyPct: text(formData, "contingencyPct"),
    });
  } catch (error) {
    if (error instanceof ProjectValidationError || error instanceof DuplicateEstimateError) {
      redirect(withErrorFlash(`/projects/${projectId}`, error.message));
    }
    throw error;
  }
  redirect(`/estimates/${estimate.id}`);
}

export async function updateEstimateAction(estimateId: string, formData: FormData): Promise<void> {
  let estimate;
  try {
    estimate = await updateEstimate(estimateId, {
      milestone: text(formData, "milestone") as EstimateMilestone,
      revision: Number(text(formData, "revision")),
      label: text(formData, "label"),
      contingencyPct: text(formData, "contingencyPct"),
    });
  } catch (error) {
    if (error instanceof ProjectValidationError || error instanceof DuplicateEstimateError) {
      redirect(withErrorFlash(`/estimates/${estimateId}`, error.message));
    }
    throw error;
  }
  revalidatePath(`/estimates/${estimate.id}`);
  revalidatePath(`/projects/${estimate.projectId}`);
}
