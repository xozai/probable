import { describe, expect, it } from "vitest";

import {
  assertFirmId,
  assertFirmOwner,
  FirmForbiddenError,
  FirmNotFoundError,
} from "./authorization-policy";

describe("firm authorization", () => {
  it("accepts owners for settings actions", () => {
    expect(() => assertFirmOwner({ role: "owner" })).not.toThrow();
  });

  it("rejects members from owner-only settings actions", () => {
    expect(() => assertFirmOwner({ role: "member" })).toThrow(FirmForbiddenError);
  });

  it("maps malformed tenant identifiers to not found", () => {
    expect(() => assertFirmId("not-a-uuid")).toThrow(FirmNotFoundError);
    expect(() => assertFirmId("d9428888-122b-4c26-a5ca-3da3c0a19c2f")).not.toThrow();
  });
});
