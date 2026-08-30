import type { FirmRole } from "../auth/authorization-policy";

export interface FirmSummary {
  id: string;
  name: string;
  role: FirmRole;
}

export interface FirmSettingsInput {
  name: string;
  disclaimerText?: string | null;
  logoUrl?: string | null;
}
