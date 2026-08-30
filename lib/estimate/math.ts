import Decimal from "decimal.js";

/**
 * Shared money policy (ARCHITECTURE.md §4):
 * line extension = round_half_up(quantity * unit_price, 2)
 * subtotal = sum(line extensions)
 * contingency = round_half_up(subtotal * pct / 100, 2)
 * total = subtotal + contingency
 * Decimal arithmetic only; negative quantities are rejected.
 */

export class NegativeQuantityError extends Error {
  constructor(quantity: Decimal.Value) {
    super(`quantity must not be negative: ${quantity}`);
    this.name = "NegativeQuantityError";
  }
}

export interface LineItemInput {
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
}

export interface EstimateTotals {
  lineExtensions: string[];
  subtotal: string;
  contingency: string;
  total: string;
}

function roundHalfUp(value: Decimal, decimalPlaces: number): Decimal {
  return value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

export function computeLineExtension(
  quantity: Decimal.Value,
  unitPrice: Decimal.Value,
): string {
  const qty = new Decimal(quantity);
  if (qty.isNegative()) {
    throw new NegativeQuantityError(quantity);
  }
  const price = new Decimal(unitPrice);
  return roundHalfUp(qty.times(price), 2).toFixed(2);
}

export function computeEstimateTotals(
  lineItems: readonly LineItemInput[],
  contingencyPct: Decimal.Value,
): EstimateTotals {
  const lineExtensions = lineItems.map((item) =>
    computeLineExtension(item.quantity, item.unitPrice),
  );

  const subtotal = lineExtensions.reduce(
    (sum, extension) => sum.plus(new Decimal(extension)),
    new Decimal(0),
  );

  const contingency = roundHalfUp(
    subtotal.times(new Decimal(contingencyPct).dividedBy(100)),
    2,
  );

  const total = subtotal.plus(contingency);

  return {
    lineExtensions,
    subtotal: subtotal.toFixed(2),
    contingency: contingency.toFixed(2),
    total: total.toFixed(2),
  };
}
