import { eq } from "drizzle-orm";

import {
  requireAuthenticatedUser,
  requireFirmOwner,
} from "../auth/authorization";
import { db } from "../db/client";
import { firmMembers, firms } from "../db/schema";

import { createFirmForUser } from "./repository";
import type { FirmSettingsInput, FirmSummary } from "./service-types";
import { validateFirmName } from "./validation";

export type { FirmSettingsInput, FirmSummary } from "./service-types";
export { createFirmForUser } from "./repository";
export { validateFirmName } from "./validation";

export async function createFirmForCurrentUser(name: string): Promise<FirmSummary> {
  const user = await requireAuthenticatedUser();
  return createFirmForUser(user.userId, name);
}

export async function listFirmsForCurrentUser(): Promise<FirmSummary[]> {
  const user = await requireAuthenticatedUser();
  return db
    .select({ id: firms.id, name: firms.name, role: firmMembers.role })
    .from(firmMembers)
    .innerJoin(firms, eq(firmMembers.firmId, firms.id))
    .where(eq(firmMembers.userId, user.userId))
    .orderBy(firms.name);
}

export async function updateFirmSettings(
  firmId: string,
  input: FirmSettingsInput,
): Promise<FirmSummary> {
  await requireFirmOwner(firmId);
  const name = validateFirmName(input.name);
  const [firm] = await db
    .update(firms)
    .set({
      name,
      disclaimerText: input.disclaimerText?.trim() || null,
      logoUrl: input.logoUrl?.trim() || null,
    })
    .where(eq(firms.id, firmId))
    .returning({ id: firms.id, name: firms.name });

  if (!firm) throw new Error("Firm disappeared after authorization");
  return { ...firm, role: "owner" };
}
