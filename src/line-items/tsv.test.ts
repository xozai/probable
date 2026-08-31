import { describe, expect, it } from "vitest";

import { parseTsvPaste } from "./tsv";

describe("parseTsvPaste", () => {
  it("parses well-formed rows", () => {
    const text = ["Excavation\t120\tCY", "Base course\t340.5\tSY", "Curb\t500\tLF"].join("\n");
    const { rows, errors } = parseTsvPaste(text);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.row).toEqual({
      description: "Excavation",
      quantity: "120.000",
      unit: "CY",
      unitPrice: null,
    });
  });

  it("ignores blank lines", () => {
    const { rows } = parseTsvPaste("Excavation\t120\tCY\n\n\nCurb\t500\tLF");
    expect(rows).toHaveLength(2);
  });

  it("flags rows with the wrong column count and rows with invalid values, indexed against the pasted text", () => {
    const text = ["Excavation\t120\tCY", "Missing unit\t50", "Curb\tabc\tLF"].join("\n");
    const { rows, errors } = parseTsvPaste(text);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.index)).toEqual([1, 2]);
    expect(errors[0]?.message).toMatch(/3 tab-separated columns/);
    expect(errors[1]?.message).toMatch(/non-negative number/);
  });
});
