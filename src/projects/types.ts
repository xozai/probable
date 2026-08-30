export const ESTIMATE_MILESTONES = ["30", "60", "90", "100", "custom"] as const;

export type EstimateMilestone = (typeof ESTIMATE_MILESTONES)[number];

export interface ProjectInput {
  name: string;
  location?: string | null;
  district?: string | null;
}

export interface EstimateInput {
  milestone: EstimateMilestone;
  revision: number;
  label?: string | null;
  contingencyPct: string;
}
