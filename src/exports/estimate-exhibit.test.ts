import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXHIBIT_DISCLAIMER,
  buildEstimateExhibit,
  estimatePdfFilename,
  type EstimateExhibit,
} from "./estimate-exhibit";
import { renderEstimatePdf } from "./estimate-pdf";

function fixture(): EstimateExhibit {
  return buildEstimateExhibit({
    firm: { name: "Oak Creek Civil", logoUrl: null, disclaimerText: null },
    project: {
      name: "Oak Creek Phase 2",
      location: "Austin, Texas",
      district: "Austin",
    },
    estimate: {
      milestone: "30",
      revision: 1,
      label: "Design development",
      contingencyPct: "20.00",
      createdAt: new Date("2026-08-30T12:00:00Z"),
    },
    sections: [
      { id: "earthwork", name: "Earthwork", sort: 0 },
      { id: "paving", name: "Paving", sort: 1 },
    ],
    lineItems: [
      {
        id: "excavation",
        sectionId: "earthwork",
        sort: 0,
        description: "Excavation",
        quantity: "10.000",
        unit: "CY",
        unitPrice: "25.00",
        priceSource: "seed",
        priceProvenance: {
          source: "TxDOT Bid Tabulations via data.texas.gov",
          district: "Austin",
          window_from: "2025-09-01",
          window_to: "2026-08-31",
          retrieved_at: "2026-08-30T00:00:00Z",
        },
      },
      {
        id: "paving",
        sectionId: "paving",
        sort: 1,
        description: "Concrete paving",
        quantity: "2.000",
        unit: "SY",
        unitPrice: "100.00",
        priceSource: "manual",
        priceProvenance: null,
      },
    ],
  });
}

describe("estimate exhibit", () => {
  it("carries every section and line through the shared totals result", () => {
    const exhibit = fixture();
    expect(exhibit.sections).toMatchObject([
      {
        name: "Earthwork",
        subtotal: "250.00",
        lineItems: [
          {
            description: "Excavation",
            unitPrice: "25.00",
            extension: "250.00",
          },
        ],
      },
      {
        name: "Paving",
        subtotal: "200.00",
        lineItems: [{ description: "Concrete paving", extension: "200.00" }],
      },
    ]);
    expect(exhibit.totals).toEqual({
      subtotal: "450.00",
      contingency: "90.00",
      total: "540.00",
      unpricedCount: 0,
    });
    expect(exhibit.firm.disclaimer).toBe(DEFAULT_EXHIBIT_DISCLAIMER);
  });

  it("formats seed provenance and a safe attachment filename", () => {
    const exhibit = fixture();
    expect(exhibit.seedAttributions).toEqual([
      "Seed unit prices: TxDOT Bid Tabulations via data.texas.gov, Austin district, lettings 2025-09-01–2026-08-31, retrieved 2026-08-30.",
    ]);
    expect(estimatePdfFilename(exhibit)).toBe(
      "oak-creek-phase-2-30-percent-rev-1.pdf",
    );
  });

  it("renders a non-empty PDF document", async () => {
    const buffer = await renderEstimatePdf(fixture());
    expect(buffer.byteLength).toBeGreaterThan(2_000);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
