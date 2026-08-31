import type { LineItemRowInput } from "./types";

export class LineItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineItemValidationError";
  }
}

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_UNIT_LENGTH = 20;
// Matches line_items.quantity numeric(14,3); the CHECK constraint rejects
// negative values independently (defense in depth, per lib/estimate/math.ts).
const QUANTITY_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;

export interface ValidatedLineItemRow {
  description: string;
  quantity: string;
  unit: string;
}

export function validateLineItemRow(input: LineItemRowInput): ValidatedLineItemRow {
  const description = input.description?.trim();
  if (!description) throw new LineItemValidationError("Description is required");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new LineItemValidationError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
  }

  const quantityRaw = input.quantity?.trim();
  if (!quantityRaw || !QUANTITY_PATTERN.test(quantityRaw)) {
    throw new LineItemValidationError("Quantity must be a non-negative number with up to 3 decimal places");
  }

  const unit = input.unit?.trim();
  if (!unit) throw new LineItemValidationError("Unit is required");
  if (unit.length > MAX_UNIT_LENGTH) {
    throw new LineItemValidationError(`Unit must be ${MAX_UNIT_LENGTH} characters or fewer`);
  }

  return { description, quantity: Number(quantityRaw).toFixed(3), unit };
}
