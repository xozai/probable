import { asc, eq } from "drizzle-orm";

import { requireFirmMember, requireFirmOwner } from "../auth/authorization";
import { db } from "../db/client";
import { estimateSections, firmSectionTemplates } from "../db/schema";
import { getEstimate } from "../projects/service";
import { validateSectionNames } from "./validation";

export async function listFirmSectionTemplates(firmId: string) {
  await requireFirmMember(firmId);
  return db
    .select()
    .from(firmSectionTemplates)
    .where(eq(firmSectionTemplates.firmId, firmId))
    .orderBy(asc(firmSectionTemplates.sort));
}

export async function replaceFirmSectionTemplates(
  firmId: string,
  names: readonly string[],
) {
  await requireFirmOwner(firmId);
  const validNames = validateSectionNames(names);
  return db.transaction(async (tx) => {
    await tx
      .delete(firmSectionTemplates)
      .where(eq(firmSectionTemplates.firmId, firmId));
    return tx
      .insert(firmSectionTemplates)
      .values(validNames.map((name, sort) => ({ firmId, name, sort })))
      .returning();
  });
}

export async function listEstimateSections(estimateId: string) {
  await getEstimate(estimateId);
  return db
    .select()
    .from(estimateSections)
    .where(eq(estimateSections.estimateId, estimateId))
    .orderBy(asc(estimateSections.sort));
}
