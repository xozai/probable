import { describe, expect, it } from "vitest";

import { generateInvitationToken, hashInvitationToken } from "./tokens";

describe("invitation tokens", () => {
  it("generates unique tokens", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("hashes deterministically and never stores the plaintext token as its own hash", () => {
    const { token, tokenHash } = generateInvitationToken();
    expect(hashInvitationToken(token)).toBe(tokenHash);
    expect(tokenHash).not.toBe(token);
  });
});
