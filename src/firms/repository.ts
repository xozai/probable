import { db } from "../db/client";
import { firmMembers, firms, firmSectionTemplates } from "../db/schema";
import { DEFAULT_SECTION_NAMES } from "../sections/defaults";
import type { FirmSummary } from "./service-types";
import { validateFirmName } from "./validation";

export async function createFirmForUser(
  userId: string,
  name: string,
): Promise<FirmSummary> {
  const normalizedName = validateFirmName(name);

  return db.transaction(async (tx) => {
    const [firm] = await tx
      .insert(firms)
      .values({ name: normalizedName })
      .returning({ id: firms.id, name: firms.name });
    if (!firm) throw new Error("Firm creation failed");

    await tx.insert(firmMembers).values({
      firmId: firm.id,
      userId,
      role: "owner",
    });

    await tx.insert(firmSectionTemplates).values(
      DEFAULT_SECTION_NAMES.map((sectionName, sort) => ({
        firmId: firm.id,
        name: sectionName,
        sort,
      })),
    );

    return { ...firm, role: "owner" as const };
  });
}
