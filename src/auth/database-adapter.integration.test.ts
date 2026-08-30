import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "../db/client";
import { authVerificationTokens, users } from "../db/schema";
import { createDatabaseAuthAdapter } from "./database-adapter";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;
const testEmail = `auth-${crypto.randomUUID()}@example.test`;

describeWithDatabase("database auth adapter", () => {
  const adapter = createDatabaseAuthAdapter();

  afterAll(async () => {
    await db.delete(authVerificationTokens).where(eq(authVerificationTokens.identifier, testEmail));
    await db.delete(users).where(eq(users.email, testEmail));
  });

  it("persists users and consumes magic-link tokens once", async () => {
    const user = await adapter.createUser?.({
      id: crypto.randomUUID(),
      name: "Test Engineer",
      email: testEmail.toUpperCase(),
      emailVerified: null,
      image: null,
    });
    expect(user?.email).toBe(testEmail);
    await expect(adapter.getUserByEmail?.(testEmail.toUpperCase())).resolves.toMatchObject({
      id: user?.id,
    });

    const verificationToken = {
      identifier: testEmail,
      token: `token-${crypto.randomUUID()}`,
      expires: new Date(Date.now() + 60_000),
    };
    await adapter.createVerificationToken?.(verificationToken);
    await expect(adapter.useVerificationToken?.(verificationToken)).resolves.toMatchObject(
      verificationToken,
    );
    await expect(adapter.useVerificationToken?.(verificationToken)).resolves.toBeNull();
  });
});
