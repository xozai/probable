import { describe, expect, it } from "vitest";

import { createTestAdapter } from "./test-adapter";

describe("test auth adapter", () => {
  it("stores normalized users without external services", async () => {
    const adapter = createTestAdapter();
    const created = await adapter.createUser?.({
      id: "user-1",
      name: null,
      email: " PE@Firm.Test ",
      emailVerified: null,
      image: null,
    });

    expect(created?.email).toBe("pe@firm.test");
    await expect(adapter.getUserByEmail?.("PE@FIRM.TEST")).resolves.toEqual(created);
  });

  it("consumes verification tokens exactly once", async () => {
    const adapter = createTestAdapter();
    const verificationToken = {
      identifier: "PE@Firm.Test",
      token: "hashed-token",
      expires: new Date("2026-08-31T00:00:00Z"),
    };
    await adapter.createVerificationToken?.(verificationToken);

    await expect(
      adapter.useVerificationToken?.({
        identifier: "pe@firm.test",
        token: "hashed-token",
      }),
    ).resolves.toMatchObject({ identifier: "pe@firm.test" });
    await expect(
      adapter.useVerificationToken?.({
        identifier: "pe@firm.test",
        token: "hashed-token",
      }),
    ).resolves.toBeNull();
  });
});
