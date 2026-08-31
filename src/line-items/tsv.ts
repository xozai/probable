import { LineItemValidationError, validateLineItemRow, type ValidatedLineItemRow } from "./validation";

// TSV paste is atomic (docs/DECISIONS.md 2026-08-30): rows are staged and
// validated together; nothing persists until every staged row is valid.
// This module is a pure parser with no DB dependency so both the client
// grid (inline feedback while staging) and the server action (authoritative
// gate before commit) can share one row-validation source of truth.

export interface PasteRowError {
  index: number;
  raw: string;
  message: string;
}

export interface PasteRowResult {
  index: number;
  raw: string;
  row: ValidatedLineItemRow;
}

export interface ParsedPaste {
  rows: PasteRowResult[];
  errors: PasteRowError[];
}

export function parseTsvPaste(text: string): ParsedPaste {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  const rows: PasteRowResult[] = [];
  const errors: PasteRowError[] = [];

  lines.forEach((line, index) => {
    const cells = line.split("\t");
    if (cells.length !== 3) {
      errors.push({
        index,
        raw: line,
        message: `Expected 3 tab-separated columns (description, quantity, unit), found ${cells.length}`,
      });
      return;
    }
    const [description = "", quantity = "", unit = ""] = cells;
    try {
      rows.push({ index, raw: line, row: validateLineItemRow({ description, quantity, unit }) });
    } catch (error) {
      const message = error instanceof LineItemValidationError ? error.message : "Invalid row";
      errors.push({ index, raw: line, message });
    }
  });

  return { rows, errors };
}
