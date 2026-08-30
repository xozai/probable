import { describe, expect, it } from "vitest";

import { isEmailAllowed, normalizeEmail, parseAllowedEmails } from "./email-policy";

describe("email policy", () => {
  it("normalizes addresses before comparing them", () => {
    const allowed = parseAllowedEmails(" owner@example.com,PE@Firm.test ");

    expect(normalizeEmail(" Owner@Example.COM ")).toBe("owner@example.com");
    expect(isEmailAllowed("PE@FIRM.TEST", allowed)).toBe(true);
  });

  it("rejects missing and unapproved addresses", () => {
    const allowed = parseAllowedEmails("owner@example.com");

    expect(isEmailAllowed(undefined, allowed)).toBe(false);
    expect(isEmailAllowed("other@example.com", allowed)).toBe(false);
  });
});
