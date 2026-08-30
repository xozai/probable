import {
  ESTIMATE_MILESTONES,
  type EstimateInput,
  type EstimateMilestone,
  type ProjectInput,
} from "./types";

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

function optionalText(value: string | null | undefined, max: number): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > max) throw new ProjectValidationError(`Value must be ${max} characters or fewer`);
  return normalized;
}

export function validateProjectInput(input: ProjectInput): Required<ProjectInput> {
  const name = input.name?.trim();
  if (!name) throw new ProjectValidationError("Project name is required");
  if (name.length > 120) throw new ProjectValidationError("Project name must be 120 characters or fewer");
  return {
    name,
    location: optionalText(input.location, 160),
    district: optionalText(input.district, 80),
  };
}

export function validateEstimateInput(input: EstimateInput): EstimateInput {
  if (!ESTIMATE_MILESTONES.includes(input.milestone as EstimateMilestone)) {
    throw new ProjectValidationError("Select a valid milestone");
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new ProjectValidationError("Revision must be a positive integer");
  }
  if (!/^\d{1,2}(\.\d{1,2})?$|^100(\.0{1,2})?$/.test(input.contingencyPct)) {
    throw new ProjectValidationError("Contingency must be between 0 and 100 with at most two decimals");
  }
  return {
    ...input,
    label: optionalText(input.label, 120),
    contingencyPct: Number(input.contingencyPct).toFixed(2),
  };
}
