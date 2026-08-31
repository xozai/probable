"use client";

import { useState, useTransition, type FormEvent } from "react";

import { parseTsvPaste } from "@/line-items/tsv";

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

const emptyNewRow = { description: "", quantity: "", unit: "" };

export function LineItemGrid({ estimateId, initialItems }: { estimateId: string; initialItems: LineItemDTO[] }) {
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

  function handleEditField(id: string, field: "description" | "quantity" | "unit", value: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function handleEditCommit(item: LineItemDTO) {
    startTransition(async () => {
      const result = await updateLineItemAction(estimateId, item.id, {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
      });
      if (result.ok) {
        setItems((current) => current.map((row) => (row.id === item.id ? result.data : row)));
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
    </section>
  );
}
