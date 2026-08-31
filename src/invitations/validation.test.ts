import { describe, expect, it } from "vitest";

import { InvitationValidationError, validateInviteEmail } from "./validation";

describe("invitation email validation", () => {
  it("trims and accepts a valid email", () => {
    expect(validateInviteEmail("  person@example.com  ")).toBe("person@example.com");
  });

  it.each([undefined, "not-an-email", "  "])(
    "rejects invalid emails as InvitationValidationError (#33 item 1) %#",
    (value) => {
      expect(() => validateInviteEmail(value)).toThrow(InvitationValidationError);
    },
  );
});
