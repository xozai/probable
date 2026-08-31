import { describe, expect, it } from "vitest";

import { buildEstimatePresentation } from "./presentation";

describe("buildEstimatePresentation", () => {
  it("uses shared decimal results for extensions, section subtotals, contingency, and total", () => {
    const result = buildEstimatePresentation(
      [
        { id: "earthwork", name: "Earthwork", sort: 0 },
        { id: "paving", name: "Paving", sort: 1 },
      ],
      [
        { id: "a", sectionId: "earthwork", quantity: "1.25", unitPrice: "0.02" },
        { id: "b", sectionId: "earthwork", quantity: "2", unitPrice: "10.00" },
        { id: "c", sectionId: "paving", quantity: "3", unitPrice: "5.00" },
      ],
      "10",
    );

    expect(result.sections[0]).toMatchObject({
      name: "Earthwork",
      subtotal: "20.03",
      lineItems: [
        { id: "a", extension: "0.03" },
        { id: "b", extension: "20.00" },
      ],
    });
    expect(result.sections[1]).toMatchObject({ name: "Paving", subtotal: "15.00" });
    expect(result).toMatchObject({
      subtotal: "35.03",
      contingency: "3.50",
      total: "38.53",
      unpricedCount: 0,
    });
  });

  it("shows unpriced and unassigned rows without including them in totals", () => {
    const result = buildEstimatePresentation(
      [{ id: "earthwork", name: "Earthwork", sort: 0 }],
      [
        { id: "priced", sectionId: null, quantity: "2", unitPrice: "4.00" },
        { id: "unpriced", sectionId: "earthwork", quantity: "100", unitPrice: null },
      ],
      "20",
    );

    expect(result.sections).toEqual([
      expect.objectContaining({
        name: "Earthwork",
        subtotal: "0.00",
        lineItems: [{ id: "unpriced", extension: null }],
      }),
      expect.objectContaining({
        name: "Uncategorized",
        subtotal: "8.00",
        lineItems: [{ id: "priced", extension: "8.00" }],
      }),
    ]);
    expect(result).toMatchObject({
      subtotal: "8.00",
      contingency: "1.60",
      total: "9.60",
      unpricedCount: 1,
    });
  });
});
