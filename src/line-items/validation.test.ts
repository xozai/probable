import { describe, expect, it } from "vitest";

import { LineItemValidationError, validateLineItemRow } from "./validation";

describe("validateLineItemRow", () => {
  it("normalizes and pads valid input", () => {
    expect(validateLineItemRow({ description: "  Excavation  ", quantity: "120.5", unit: " CY " })).toEqual({
      description: "Excavation",
      quantity: "120.500",
      unit: "CY",
      unitPrice: null,
    });
  });

  it("normalizes an optional manual unit price", () => {
    expect(
      validateLineItemRow({
        description: "Excavation",
        quantity: "1",
        unit: "CY",
        unitPrice: " 12.5 ",
      }),
    ).toMatchObject({ unitPrice: "12.50" });
  });

  it.each([
    { description: "", quantity: "10", unit: "CY" },
    { description: "Excavation", quantity: "", unit: "CY" },
    { description: "Excavation", quantity: "abc", unit: "CY" },
    { description: "Excavation", quantity: "-5", unit: "CY" },
    { description: "Excavation", quantity: "5.1234", unit: "CY" },
    { description: "Excavation", quantity: "10", unit: "" },
    { description: "Excavation", quantity: "10", unit: "CY", unitPrice: "-1" },
    { description: "Excavation", quantity: "10", unit: "CY", unitPrice: "1.234" },
  ])("rejects invalid row %#", (input) => {
    expect(() => validateLineItemRow(input)).toThrow(LineItemValidationError);
  });
});
