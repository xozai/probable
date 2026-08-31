import { describe, expect, it } from "vitest";

import { FirmValidationError, validateFirmName } from "./validation";

describe("firm name validation", () => {
  it("trims and accepts a valid name", () => {
    expect(validateFirmName("  Oak Creek Civil  ")).toBe("Oak Creek Civil");
  });

  it.each([undefined, "a", "x".repeat(121)])(
    "rejects invalid names as FirmValidationError (#33 item 1) %#",
    (value) => {
      expect(() => validateFirmName(value)).toThrow(FirmValidationError);
    },
  );
});
