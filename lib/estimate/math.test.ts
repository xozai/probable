import { describe, expect, it } from "vitest";
import {
  NegativeQuantityError,
  computeEstimateTotals,
  computeLineExtension,
} from "./math";

describe("computeLineExtension", () => {
  // T-AC5-01: zero quantity
  it("returns 0.00 for zero quantity", () => {
    expect(computeLineExtension(0, "100.00")).toBe("0.00");
  });

  // T-AC5-02: high-precision quantity
  it("rounds a high-precision quantity to the cent", () => {
    expect(computeLineExtension("0.001", "100.00")).toBe("0.10");
  });

  // T-AC5-03: large value, no floating-point drift
  it("computes large values exactly", () => {
    expect(computeLineExtension("1000000", "1500.00")).toBe(
      "1500000000.00",
    );
  });

  // T-AC5-04: rounding boundary (x.xx5)
  it("rounds a x.xx5 boundary half up", () => {
    // 1.25 * 0.02 = 0.025 -> rounds up to 0.03
    expect(computeLineExtension("1.25", "0.02")).toBe("0.03");
  });

  // T-AC5-05: negative quantity is rejected
  it("rejects a negative quantity", () => {
    expect(() => computeLineExtension(-1, "100.00")).toThrow(
      NegativeQuantityError,
    );
  });
});

describe("computeEstimateTotals", () => {
  it("sums line extensions into a subtotal and applies contingency", () => {
    const result = computeEstimateTotals(
      [
        { quantity: "10", unitPrice: "25.00" }, // 250.00
        { quantity: "0.001", unitPrice: "100.00" }, // 0.10
      ],
      "20.00",
    );
    expect(result.lineExtensions).toEqual(["250.00", "0.10"]);
    expect(result.subtotal).toBe("250.10");
    // contingency = round_half_up(250.10 * 0.20, 2) = 50.02
    expect(result.contingency).toBe("50.02");
    expect(result.total).toBe("300.12");
  });

  it("rounds contingency at a x.xx5 boundary half up", () => {
    // subtotal 0.25, pct 10 -> raw contingency 0.025 -> rounds to 0.03
    const result = computeEstimateTotals(
      [{ quantity: "1", unitPrice: "0.25" }],
      "10",
    );
    expect(result.subtotal).toBe("0.25");
    expect(result.contingency).toBe("0.03");
    expect(result.total).toBe("0.28");
  });

  // T-AC5-05 via the aggregate entry point: no totals are produced when any
  // line item has a negative quantity.
  it("propagates the negative-quantity rejection and computes nothing", () => {
    expect(() =>
      computeEstimateTotals(
        [
          { quantity: "10", unitPrice: "25.00" },
          { quantity: "-1", unitPrice: "5.00" },
        ],
        "20.00",
      ),
    ).toThrow(NegativeQuantityError);
  });
});
