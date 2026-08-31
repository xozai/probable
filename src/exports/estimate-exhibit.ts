import {
  buildEstimatePresentation,
  type EstimatePresentation,
} from "../../lib/estimate/presentation";

export const DEFAULT_EXHIBIT_DISCLAIMER =
  "This opinion of probable construction cost is preliminary and non-binding. Actual bids and construction costs may vary based on market conditions, final design, and contractor means and methods.";

interface SourceLineItem {
  id: string;
  sectionId: string | null;
  sort: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string | null;
  priceSource: "seed" | "firm" | "manual" | null;
  priceProvenance: unknown;
}

export interface ExhibitLineItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string | null;
  extension: string | null;
}

export interface ExhibitSection {
  id: string | null;
  name: string;
  sort: number;
  lineItems: ExhibitLineItem[];
  subtotal: string;
}

export interface EstimateExhibit {
  firm: {
    name: string;
    logoUrl: string | null;
    disclaimer: string;
  };
  project: {
    name: string;
    location: string | null;
    district: string | null;
  };
  estimate: {
    milestone: string;
    revision: number;
    label: string | null;
    contingencyPct: string;
    createdAt: Date;
  };
  sections: ExhibitSection[];
  totals: Pick<
    EstimatePresentation,
    "subtotal" | "contingency" | "total" | "unpricedCount"
  >;
  seedAttributions: string[];
}

function textValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function seedAttribution(
  provenance: unknown,
  projectDistrict: string | null,
): string {
  const record =
    typeof provenance === "object" && provenance !== null
      ? (provenance as Record<string, unknown>)
      : {};
  const source =
    textValue(record, "source") ?? "TxDOT Bid Tabulations via data.texas.gov";
  const geography =
    textValue(record, "geography", "district") ?? projectDistrict;
  const windowFrom = textValue(record, "windowFrom", "window_from");
  const windowTo = textValue(record, "windowTo", "window_to");
  const retrievedAt = textValue(record, "retrievedAt", "retrieved_at");

  const details = [
    geography ? `${geography} district` : null,
    windowFrom && windowTo ? `lettings ${windowFrom}–${windowTo}` : null,
    retrievedAt ? `retrieved ${retrievedAt.slice(0, 10)}` : null,
  ].filter((value): value is string => Boolean(value));
  return `Seed unit prices: ${source}${details.length ? `, ${details.join(", ")}` : ""}.`;
}

export function buildEstimateExhibit(
  input: {
    firm: { name: string; logoUrl: string | null; disclaimerText: string | null };
    project: { name: string; location: string | null; district: string | null };
    estimate: {
      milestone: string;
      revision: number;
      label: string | null;
      contingencyPct: string;
      createdAt: Date;
    };
    sections: Array<{ id: string; name: string; sort: number }>;
    lineItems: SourceLineItem[];
  },
): EstimateExhibit {
  const presentation = buildEstimatePresentation(
    input.sections,
    input.lineItems,
    input.estimate.contingencyPct,
  );
  const lineItemById = new Map(input.lineItems.map((item) => [item.id, item]));
  const sections = presentation.sections.map((section) => ({
    ...section,
    lineItems: section.lineItems.map((presented) => {
      const item = lineItemById.get(presented.id);
      if (!item) throw new Error(`Presentation referenced missing line item ${presented.id}`);
      return {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        extension: presented.extension,
      };
    }),
  }));
  const seedAttributions = Array.from(
    new Set(
      input.lineItems
        .filter((item) => item.priceSource === "seed")
        .map((item) => seedAttribution(item.priceProvenance, input.project.district)),
    ),
  );

  return {
    firm: {
      name: input.firm.name,
      logoUrl: input.firm.logoUrl,
      disclaimer: input.firm.disclaimerText?.trim() || DEFAULT_EXHIBIT_DISCLAIMER,
    },
    project: input.project,
    estimate: input.estimate,
    sections,
    totals: {
      subtotal: presentation.subtotal,
      contingency: presentation.contingency,
      total: presentation.total,
      unpricedCount: presentation.unpricedCount,
    },
    seedAttributions,
  };
}

export function estimatePdfFilename(exhibit: EstimateExhibit): string {
  const milestone = exhibit.estimate.milestone === "custom"
    ? "custom"
    : `${exhibit.estimate.milestone}-percent`;
  const stem = `${exhibit.project.name}-${milestone}-rev-${exhibit.estimate.revision}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "estimate";
  return `${stem}.pdf`;
}
