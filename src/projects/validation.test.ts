import { describe, expect, it } from "vitest";

import { ProjectValidationError, validateEstimateInput, validateProjectInput } from "./validation";

describe("project and estimate validation", () => {
  it("normalizes project fields", () => {
    expect(validateProjectInput({ name: "  Waterline A  ", location: "  Houston  " })).toEqual({
      name: "Waterline A",
      location: "Houston",
      district: null,
    });
  });

  it("rejects missing project names", () => {
    expect(() => validateProjectInput({ name: "  " })).toThrow(ProjectValidationError);
  });

  it("normalizes valid estimate values", () => {
    expect(validateEstimateInput({ milestone: "60", revision: 2, contingencyPct: "7.5" })).toMatchObject({
      milestone: "60",
      revision: 2,
      contingencyPct: "7.50",
      label: null,
    });
  });

  it.each([
    { milestone: "60" as const, revision: 0, contingencyPct: "10" },
    { milestone: "60" as const, revision: 1.5, contingencyPct: "10" },
    { milestone: "60" as const, revision: 1, contingencyPct: "100.01" },
    { milestone: "60" as const, revision: 1, contingencyPct: "1.234" },
  ])("rejects invalid estimate input %#", (input) => {
    expect(() => validateEstimateInput(input)).toThrow(ProjectValidationError);
  });
});
