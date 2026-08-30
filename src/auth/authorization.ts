import { eq } from "drizzle-orm";

import { auth } from "../auth";
import { db } from "../db/client";
import { users } from "../db/schema";
import {
  assertFirmId,
  assertFirmOwner,
  FirmNotFoundError,
  UnauthorizedError,
  type AuthenticatedUser,
  type FirmAccess,
} from "./authorization-policy";
import { normalizeEmail } from "./email-policy";
import { getFirmMembership } from "./firm-membership";

export * from "./authorization-policy";
export { getFirmMembership } from "./firm-membership";

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user?.email) throw new UnauthorizedError();

  const email = normalizeEmail(session.user.email);
  const [user] = await db
    .select({ userId: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) throw new UnauthorizedError();
  return { userId: user.userId, email };
}

export async function requireFirmMember(firmId: string): Promise<FirmAccess> {
  assertFirmId(firmId);
  const user = await requireAuthenticatedUser();
  const membership = await getFirmMembership(user.userId, firmId);
  if (!membership) throw new FirmNotFoundError();
  return { ...user, ...membership };
}

export async function requireFirmOwner(firmId: string): Promise<FirmAccess> {
  const access = await requireFirmMember(firmId);
  assertFirmOwner(access);
  return access;
}
