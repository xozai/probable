"use server";

import { revalidatePath } from "next/cache";

import {
  addLineItem,
  deleteLineItem,
  LineItemNotFoundError,
  listLineItems,
  pasteLineItems,
  PasteValidationError,
  reorderLineItems,
  updateLineItem,
} from "@/line-items/service";
import { LineItemValidationError } from "@/line-items/validation";
import type { PasteRowError } from "@/line-items/tsv";
import { EstimateNotFoundError } from "@/projects/service";

export interface LineItemDTO {
  id: string;
  sectionId: string | null;
  sort: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string | null;
}

interface LineItemRow {
  id: string;
  sectionId: string | null;
  sort: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string | null;
}

interface EditableLineItemInput {
  description: string;
  quantity: string;
  unit: string;
  unitPrice?: string | null;
  sectionId?: string | null;
}

function toDTO(row: LineItemRow): LineItemDTO {
  return {
    id: row.id,
    sectionId: row.sectionId,
    sort: row.sort,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unitPrice,
  };
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type PasteActionResult =
  | { ok: true; data: LineItemDTO[] }
  | { ok: false; error: string; rowErrors: PasteRowError[] };

export async function listLineItemsAction(estimateId: string): Promise<ActionResult<LineItemDTO[]>> {
  try {
    const rows = await listLineItems(estimateId);
    return { ok: true, data: rows.map(toDTO) };
  } catch (error) {
    if (error instanceof EstimateNotFoundError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not load line items" };
  }
}

export async function addLineItemAction(
  estimateId: string,
  input: EditableLineItemInput,
): Promise<ActionResult<LineItemDTO>> {
  try {
    // Server actions are network-callable RPC endpoints: a forged request
    // could send extra fields regardless of this function's TypeScript
    // signature, so pick exactly the allowed fields rather than passing
    // `input` through (sectionId assignment is out of scope, see #27).
    const row = await addLineItem(estimateId, {
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unitPrice ?? null,
      sectionId: input.sectionId ?? null,
    });
    revalidatePath(`/estimates/${estimateId}`);
    return { ok: true, data: toDTO(row) };
  } catch (error) {
    if (error instanceof LineItemValidationError) return { ok: false, error: error.message };
    if (error instanceof EstimateNotFoundError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not add line item" };
  }
}

export async function updateLineItemAction(
  estimateId: string,
  lineItemId: string,
  input: EditableLineItemInput,
): Promise<ActionResult<LineItemDTO>> {
  try {
    const row = await updateLineItem(estimateId, lineItemId, {
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unitPrice ?? null,
      sectionId: input.sectionId ?? null,
    });
    revalidatePath(`/estimates/${estimateId}`);
    return { ok: true, data: toDTO(row) };
  } catch (error) {
    if (error instanceof LineItemValidationError) return { ok: false, error: error.message };
    if (error instanceof LineItemNotFoundError) return { ok: false, error: error.message };
    if (error instanceof EstimateNotFoundError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not update line item" };
  }
}

export async function deleteLineItemAction(estimateId: string, lineItemId: string): Promise<ActionResult<null>> {
  try {
    await deleteLineItem(estimateId, lineItemId);
    revalidatePath(`/estimates/${estimateId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof LineItemNotFoundError) return { ok: false, error: error.message };
    if (error instanceof EstimateNotFoundError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not delete line item" };
  }
}

export async function reorderLineItemsAction(estimateId: string, orderedIds: string[]): Promise<ActionResult<null>> {
  try {
    await reorderLineItems(estimateId, orderedIds);
    revalidatePath(`/estimates/${estimateId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof LineItemValidationError) return { ok: false, error: error.message };
    if (error instanceof EstimateNotFoundError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not reorder line items" };
  }
}

export async function pasteLineItemsAction(estimateId: string, text: string): Promise<PasteActionResult> {
  try {
    const rows = await pasteLineItems(estimateId, text);
    revalidatePath(`/estimates/${estimateId}`);
    return { ok: true, data: rows.map(toDTO) };
  } catch (error) {
    if (error instanceof PasteValidationError) {
      return { ok: false, error: error.message, rowErrors: error.rowErrors };
    }
    if (error instanceof EstimateNotFoundError) {
      return { ok: false, error: error.message, rowErrors: [] };
    }
    return { ok: false, error: "Could not paste line items", rowErrors: [] };
  }
}
