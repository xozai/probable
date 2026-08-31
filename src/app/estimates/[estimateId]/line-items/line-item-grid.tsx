"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";

import { parseTsvPaste } from "@/line-items/tsv";
import { buildEstimatePresentation } from "../../../../../lib/estimate/presentation";

import {
  addLineItemAction,
  deleteLineItemAction,
  pasteLineItemsAction,
  updateLineItemAction,
  type LineItemDTO,
} from "./actions";
import styles from "../../../firms/workspace.module.css";

interface StagedRow {
  index: number;
  raw: string;
  description: string;
  quantity: string;
  unit: string;
  error: string | null;
}

function splitStagedLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
}

function stageRows(text: string): StagedRow[] {
  const lines = splitStagedLines(text);
  const { rows, errors } = parseTsvPaste(text);
  const validByIndex = new Map(rows.map((row) => [row.index, row.row]));
  const errorByIndex = new Map(errors.map((error) => [error.index, error.message]));
  return lines.map((line, index) => {
    const valid = validByIndex.get(index);
    const cells = line.split("\t");
    return {
      index,
      raw: line,
      description: valid?.description ?? cells[0] ?? "",
      quantity: valid?.quantity ?? cells[1] ?? "",
      unit: valid?.unit ?? cells[2] ?? "",
      error: errorByIndex.get(index) ?? null,
    };
  });
}

interface EstimateSectionDTO {
  id: string;
  name: string;
  sort: number;
}

const emptyNewRow = {
  description: "",
  quantity: "",
  unit: "",
  unitPrice: "",
  sectionId: null as string | null,
};

function formatMoney(value: string): string {
  const [whole, fraction = "00"] = value.split(".");
  return `$${(whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

function hasValidDraftPrice(unitPrice: string | null): boolean {
  return unitPrice !== null && /^\d{1,12}(\.\d{0,2})?$/.test(unitPrice);
}

export function LineItemGrid({
  estimateId,
  initialItems,
  sections,
  contingencyPct,
}: {
  estimateId: string;
  initialItems: LineItemDTO[];
  sections: EstimateSectionDTO[];
  contingencyPct: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [newRow, setNewRow] = useState(emptyNewRow);
  const [formError, setFormError] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedRow[] | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAddSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await addLineItemAction(estimateId, newRow);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setItems((current) => [...current, result.data]);
      setNewRow(emptyNewRow);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteLineItemAction(estimateId, id);
      if (result.ok) setItems((current) => current.filter((item) => item.id !== id));
    });
  }

  function handleEditField(
    id: string,
    field: "description" | "quantity" | "unit" | "unitPrice" | "sectionId",
    value: string | null,
  ) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function handleEditCommit(item: LineItemDTO) {
    setFormError(null);
    startTransition(async () => {
      const result = await updateLineItemAction(estimateId, item.id, {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        sectionId: item.sectionId,
      });
      if (result.ok) {
        setItems((current) => current.map((row) => (row.id === item.id ? result.data : row)));
      } else {
        setFormError(result.error);
      }
    });
  }

  function handlePasteChange(text: string) {
    setPasteError(null);
    setStaged(text.trim() ? stageRows(text) : null);
  }

  function handlePasteSave() {
    if (!staged || staged.length === 0) return;
    const text = staged.map((row) => row.raw).join("\n");
    startTransition(async () => {
      const result = await pasteLineItemsAction(estimateId, text);
      if (!result.ok) {
        setPasteError(result.error);
        const errorByIndex = new Map(result.rowErrors.map((error) => [error.index, error.message]));
        setStaged((current) => current?.map((row) => ({ ...row, error: errorByIndex.get(row.index) ?? null })) ?? null);
        return;
      }
      setItems((current) => [...current, ...result.data]);
      setStaged(null);
      setPasteError(null);
    });
  }

  const hasStagedErrors = staged?.some((row) => row.error !== null) ?? false;
  const itemsForPresentation = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        unitPrice: hasValidDraftPrice(item.unitPrice) ? item.unitPrice : null,
      })),
    [items],
  );
  const presentation = useMemo(
    () => buildEstimatePresentation(sections, itemsForPresentation, contingencyPct),
    [contingencyPct, itemsForPresentation, sections],
  );
  const extensionById = useMemo(
    () =>
      new Map(
        presentation.sections.flatMap((section) =>
          section.lineItems.map((item) => [item.id, item.extension] as const),
        ),
      ),
    [presentation.sections],
  );

  return (
    <section className={styles.card}>
      <h2>Line items</h2>
      {items.length === 0 ? (
        <p>No line items yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Section</th>
              <th>Unit price</th>
              <th>Extension</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    aria-label="Description"
                    value={item.description}
                    onChange={(event) => handleEditField(item.id, "description", event.target.value)}
                    onBlur={() => handleEditCommit(item)}
                  />
                </td>
                <td>
                  <input
                    aria-label="Quantity"
                    value={item.quantity}
                    onChange={(event) => handleEditField(item.id, "quantity", event.target.value)}
                    onBlur={() => handleEditCommit(item)}
                  />
                </td>
                <td>
                  <input
                    aria-label="Unit"
                    value={item.unit}
                    onChange={(event) => handleEditField(item.id, "unit", event.target.value)}
                    onBlur={() => handleEditCommit(item)}
                  />
                </td>
                <td>
                  <select
                    aria-label="Section"
                    value={item.sectionId ?? ""}
                    onChange={(event) => {
                      const sectionId = event.target.value || null;
                      const updated = { ...item, sectionId };
                      handleEditField(item.id, "sectionId", sectionId);
                      handleEditCommit(updated);
                    }}
                  >
                    <option value="">Uncategorized</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>{section.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label="Unit price"
                    inputMode="decimal"
                    value={item.unitPrice ?? ""}
                    onChange={(event) => handleEditField(item.id, "unitPrice", event.target.value || null)}
                    onBlur={() => handleEditCommit(item)}
                  />
                </td>
                <td>{extensionById.get(item.id) ? formatMoney(extensionById.get(item.id)!) : "Unpriced"}</td>
                <td>
                  <button type="button" onClick={() => handleDelete(item.id)} disabled={isPending}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAddSubmit} className={styles.form}>
        <label>
          Description
          <input
            value={newRow.description}
            onChange={(event) => setNewRow((row) => ({ ...row, description: event.target.value }))}
            required
          />
        </label>
        <label>
          Quantity
          <input
            value={newRow.quantity}
            onChange={(event) => setNewRow((row) => ({ ...row, quantity: event.target.value }))}
            required
          />
        </label>
        <label>
          Unit
          <input value={newRow.unit} onChange={(event) => setNewRow((row) => ({ ...row, unit: event.target.value }))} required />
        </label>
        <label>
          Section
          <select
            value={newRow.sectionId ?? ""}
            onChange={(event) => setNewRow((row) => ({ ...row, sectionId: event.target.value || null }))}
          >
            <option value="">Uncategorized</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>{section.name}</option>
            ))}
          </select>
        </label>
        <label>
          Unit price
          <input
            inputMode="decimal"
            value={newRow.unitPrice}
            onChange={(event) => setNewRow((row) => ({ ...row, unitPrice: event.target.value }))}
          />
        </label>
        <button type="submit" disabled={isPending}>
          Add line item
        </button>
        {formError && <p role="alert">{formError}</p>}
      </form>

      <div>
        <h3>Paste rows</h3>
        <p>Tab-separated: description, quantity, unit — one row per line.</p>
        <textarea
          rows={6}
          aria-label="Paste line items"
          onChange={(event) => handlePasteChange(event.target.value)}
        />
        {staged && staged.length > 0 && (
          <>
            <ul>
              {staged.map((row) => (
                <li key={row.index}>
                  {row.description || row.raw}
                  {row.error && <span role="alert"> — {row.error}</span>}
                </li>
              ))}
            </ul>
            <button type="button" onClick={handlePasteSave} disabled={isPending || hasStagedErrors}>
              Save pasted rows
            </button>
            {hasStagedErrors && (
              <p>Fix or remove the flagged rows before saving — no rows are saved until every staged row is valid.</p>
            )}
            {pasteError && <p role="alert">{pasteError}</p>}
          </>
        )}
      </div>

      <div className={styles.totals}>
        <h3>Estimate totals</h3>
        <dl>
          {presentation.sections.map((section) => (
            <div key={section.id ?? "uncategorized"}>
              <dt>{section.name} subtotal</dt>
              <dd>{formatMoney(section.subtotal)}</dd>
            </div>
          ))}
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(presentation.subtotal)}</dd>
          </div>
          <div>
            <dt>Contingency ({contingencyPct}%)</dt>
            <dd>{formatMoney(presentation.contingency)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd><strong>{formatMoney(presentation.total)}</strong></dd>
          </div>
        </dl>
        {presentation.unpricedCount > 0 ? (
          <p role="status">
            {presentation.unpricedCount} unpriced {presentation.unpricedCount === 1 ? "item is" : "items are"} excluded from totals.
          </p>
        ) : null}
      </div>
    </section>
  );
}
