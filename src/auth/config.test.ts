import { describe, expect, it, vi } from "vitest";

import { createAuthConfig } from "./config";
import { createTestAdapter } from "./test-adapter";

describe("Auth.js config", () => {
  it("uses the injected test sender and never calls Resend", async () => {
    const sendVerificationRequest = vi.fn();
    const config = createAuthConfig({
      adapter: createTestAdapter(),
      allowedEmails: new Set(["pe@firm.test"]),
      resendApiKey: "test-key-never-used",
      emailFrom: "Probable <auth@example.test>",
      sendVerificationRequest,
    });
    const provider = config.providers[0];
    if (!provider || typeof provider === "function" || provider.type !== "email") {
      throw new Error("Expected an email provider config");
    }

    await provider.sendVerificationRequest?.({
      identifier: "pe@firm.test",
      url: "http://localhost:3000/api/auth/callback/resend?token=test",
      expires: new Date("2026-08-31T00:00:00Z"),
      provider,
      token: "test",
      theme: { colorScheme: "auto" },
      request: new Request("http://localhost:3000/sign-in"),
    });

    expect(sendVerificationRequest).toHaveBeenCalledOnce();
  });

  it("allows only configured addresses", async () => {
    const config = createAuthConfig({
      adapter: createTestAdapter(),
      allowedEmails: new Set(["pe@firm.test"]),
      resendApiKey: "test",
      emailFrom: "auth@example.test",
    });
    const signIn = config.callbacks?.signIn;
    if (!signIn) throw new Error("Missing signIn callback");

    const base = {
      account: null,
      profile: undefined,
      email: { verificationRequest: true },
      credentials: undefined,
    };
    expect(
      await signIn({
        ...base,
        user: { id: "1", email: "PE@FIRM.TEST", emailVerified: null },
      }),
    ).toBe(true);
    expect(
      await signIn({
        ...base,
        user: { id: "2", email: "other@firm.test", emailVerified: null },
      }),
    ).toBe(false);
  });

  it("allows same-origin redirects and rejects external destinations", async () => {
    vi.stubEnv("AUTH_URL", "https://probable.example");
    const config = createAuthConfig({
      adapter: createTestAdapter(),
      allowedEmails: new Set(["pe@firm.test"]),
      resendApiKey: "test",
      emailFrom: "auth@example.test",
    });
    const redirect = config.callbacks?.redirect;
    if (!redirect) throw new Error("Missing redirect callback");

    expect(
      await redirect({
        url: "https://probable.example/projects",
        baseUrl: "https://fallback.example",
      }),
    ).toBe("https://probable.example/projects");
    expect(
      await redirect({
        url: "https://attacker.example/phish",
        baseUrl: "https://fallback.example",
      }),
    ).toBe("https://probable.example");
    vi.unstubAllEnvs();
  });
});
