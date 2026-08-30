import { and, eq } from "drizzle-orm";

import { db } from "../db/client";
import { firmMembers } from "../db/schema";
import { isFirmId, type FirmRole } from "./authorization-policy";

export async function getFirmMembership(
  userId: string,
  firmId: string,
): Promise<{ firmId: string; userId: string; role: FirmRole } | null> {
  if (!isFirmId(firmId)) return null;

  const [membership] = await db
    .select({
      firmId: firmMembers.firmId,
      userId: firmMembers.userId,
      role: firmMembers.role,
    })
    .from(firmMembers)
    .where(
      and(eq(firmMembers.userId, userId), eq(firmMembers.firmId, firmId)),
    )
    .limit(1);

  return membership ?? null;
}
