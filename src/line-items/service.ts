import { eq } from "drizzle-orm";

import { FirmNotFoundError, isFirmId, requireFirmMember } from "../auth/authorization";
import { db } from "../db/client";
import { estimates, projects } from "../db/schema";
import { EstimateNotFoundError } from "../projects/service";
import * as repository from "./repository";
import { parseTsvPaste, type PasteRowError } from "./tsv";
import type { LineItemRowInput } from "./types";
import { LineItemValidationError, validateLineItemRow } from "./validation";

export class LineItemNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Line item not found");
    this.name = "LineItemNotFoundError";
  }
}

export class PasteValidationError extends Error {
  readonly status = 422;

  constructor(readonly rowErrors: PasteRowError[]) {
    super("Paste contains invalid rows");
    this.name = "PasteValidationError";
  }
}

// Tenancy derived independently per resource module (estimate -> project ->
// firm), same shape as src/projects/service.ts's loadEstimateForMember.
async function loadEstimateForMember(estimateId: string) {
  if (!isFirmId(estimateId)) throw new EstimateNotFoundError();
  const [row] = await db
    .select({ estimate: estimates, project: projects })
    .from(estimates)
    .innerJoin(projects, eq(estimates.projectId, projects.id))
    .where(eq(estimates.id, estimateId))
    .limit(1);
  if (!row) throw new EstimateNotFoundError();
  try {
    await requireFirmMember(row.project.firmId);
  } catch (error) {
    if (error instanceof FirmNotFoundError) throw new EstimateNotFoundError();
    throw error;
  }
  return row;
}

async function validateSectionAssignment(
  estimateId: string,
  sectionId: string | null | undefined,
) {
  if (!sectionId) return null;
  if (!isFirmId(sectionId)) {
    throw new LineItemValidationError("Section is not part of this estimate");
  }
  const belongsToEstimate = await repository.estimateHasSection(db, {
    estimateId,
    sectionId,
  });
  if (!belongsToEstimate) {
    throw new LineItemValidationError("Section is not part of this estimate");
  }
  return sectionId;
}

export async function listLineItems(estimateId: string) {
  await loadEstimateForMember(estimateId);
  return repository.listLineItemRows(db, estimateId);
}

export async function addLineItem(estimateId: string, input: LineItemRowInput) {
  const { estimate } = await loadEstimateForMember(estimateId);
  const values = validateLineItemRow(input);
  const sectionId = await validateSectionAssignment(estimateId, input.sectionId);
  return repository.insertLineItem(db, {
    projectId: estimate.projectId,
    estimateId,
    sectionId,
    ...values,
  });
}

export async function updateLineItem(estimateId: string, lineItemId: string, input: LineItemRowInput) {
  await loadEstimateForMember(estimateId);
  const values = validateLineItemRow(input);
  const sectionId = await validateSectionAssignment(estimateId, input.sectionId);
  const updated = await repository.updateLineItemRow(db, {
    id: lineItemId,
    estimateId,
    sectionId,
    ...values,
  });
  if (!updated) throw new LineItemNotFoundError();
  return updated;
}

export async function deleteLineItem(estimateId: string, lineItemId: string) {
  await loadEstimateForMember(estimateId);
  const deleted = await repository.deleteLineItemRow(db, { id: lineItemId, estimateId });
  if (!deleted) throw new LineItemNotFoundError();
}

export async function reorderLineItems(estimateId: string, orderedIds: string[]) {
  await loadEstimateForMember(estimateId);
  await repository.reorderLineItemRows(db, { estimateId, orderedIds });
}

// Atomic per docs/DECISIONS.md: every row is validated before any row is
// persisted. A non-empty errors list means nothing was written.
export async function pasteLineItems(estimateId: string, text: string) {
  const { estimate } = await loadEstimateForMember(estimateId);
  const { rows, errors } = parseTsvPaste(text);
  if (errors.length > 0) throw new PasteValidationError(errors);
  if (rows.length === 0) {
    throw new PasteValidationError([{ index: 0, raw: "", message: "Paste at least one row" }]);
  }
  return repository.insertPastedLineItems(db, {
    projectId: estimate.projectId,
    estimateId,
    rows: rows.map((r) => r.row),
  });
}
