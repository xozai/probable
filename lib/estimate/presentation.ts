import { computeEstimateTotals } from "./math";

export interface EstimateSectionInput {
  id: string;
  name: string;
  sort: number;
}

export interface EstimateLineItemInput {
  id: string;
  sectionId: string | null;
  quantity: string;
  unitPrice: string | null;
}

export interface PresentedLineItem {
  id: string;
  extension: string | null;
}

export interface PresentedSection {
  id: string | null;
  name: string;
  sort: number;
  lineItems: PresentedLineItem[];
  subtotal: string;
}

export interface EstimatePresentation {
  sections: PresentedSection[];
  subtotal: string;
  contingency: string;
  total: string;
  unpricedCount: number;
}

export function buildEstimatePresentation(
  sections: readonly EstimateSectionInput[],
  lineItems: readonly EstimateLineItemInput[],
  contingencyPct: string,
): EstimatePresentation {
  const pricedItems = lineItems.filter(
    (item): item is EstimateLineItemInput & { unitPrice: string } =>
      item.unitPrice !== null,
  );
  const estimateTotals = computeEstimateTotals(pricedItems, contingencyPct);
  const extensionById = new Map(
    pricedItems.map((item, index) => [
      item.id,
      estimateTotals.lineExtensions[index] ?? "0.00",
    ]),
  );

  const orderedSections = [...sections].sort((a, b) => a.sort - b.sort);
  const presentedSections: PresentedSection[] = orderedSections.map((section) => {
    const sectionItems = lineItems.filter((item) => item.sectionId === section.id);
    const sectionTotals = computeEstimateTotals(
      sectionItems
        .filter(
          (item): item is EstimateLineItemInput & { unitPrice: string } =>
            item.unitPrice !== null,
        )
        .map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
      0,
    );
    return {
      ...section,
      lineItems: sectionItems.map((item) => ({
        id: item.id,
        extension: extensionById.get(item.id) ?? null,
      })),
      subtotal: sectionTotals.subtotal,
    };
  });

  const uncategorized = lineItems.filter(
    (item) =>
      item.sectionId === null ||
      !orderedSections.some((section) => section.id === item.sectionId),
  );
  if (uncategorized.length > 0) {
    const uncategorizedTotals = computeEstimateTotals(
      uncategorized
        .filter(
          (item): item is EstimateLineItemInput & { unitPrice: string } =>
            item.unitPrice !== null,
        )
        .map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
      0,
    );
    presentedSections.push({
      id: null,
      name: "Uncategorized",
      sort: Number.MAX_SAFE_INTEGER,
      lineItems: uncategorized.map((item) => ({
        id: item.id,
        extension: extensionById.get(item.id) ?? null,
      })),
      subtotal: uncategorizedTotals.subtotal,
    });
  }

  return {
    sections: presentedSections,
    subtotal: estimateTotals.subtotal,
    contingency: estimateTotals.contingency,
    total: estimateTotals.total,
    unpricedCount: lineItems.length - pricedItems.length,
  };
}
