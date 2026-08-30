import { and, eq } from "drizzle-orm";
import type { Adapter } from "next-auth/adapters";

import { db } from "../db/client";
import { authVerificationTokens, users } from "../db/schema";
import { normalizeEmail } from "./email-policy";

export function createDatabaseAuthAdapter(): Adapter {
  return {
    async createUser(user) {
      const [created] = await db
        .insert(users)
        .values({
          name: user.name,
          email: normalizeEmail(user.email),
          emailVerified: user.emailVerified,
          image: user.image,
        })
        .returning();
      if (!created) throw new Error("Auth.js did not create a user");
      return created;
    },
    async getUser(id) {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return user ?? null;
    },
    async getUserByEmail(email) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizeEmail(email)))
        .limit(1);
      return user ?? null;
    },
    async updateUser(update) {
      const values = {
        ...(update.name !== undefined ? { name: update.name } : {}),
        ...(update.email !== undefined
          ? { email: normalizeEmail(update.email) }
          : {}),
        ...(update.emailVerified !== undefined
          ? { emailVerified: update.emailVerified }
          : {}),
        ...(update.image !== undefined ? { image: update.image } : {}),
        updatedAt: new Date(),
      };
      const [user] = await db
        .update(users)
        .set(values)
        .where(eq(users.id, update.id))
        .returning();
      if (!user) throw new Error(`Auth.js user not found: ${update.id}`);
      return user;
    },
    async createVerificationToken(token) {
      const [created] = await db
        .insert(authVerificationTokens)
        .values({ ...token, identifier: normalizeEmail(token.identifier) })
        .returning();
      return created;
    },
    async useVerificationToken({ identifier, token }) {
      const [consumed] = await db
        .delete(authVerificationTokens)
        .where(
          and(
            eq(authVerificationTokens.identifier, normalizeEmail(identifier)),
            eq(authVerificationTokens.token, token),
          ),
        )
        .returning();
      return consumed ?? null;
    },
  };
}
