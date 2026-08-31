import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "../db/client";
import { costItems, lineItems } from "../db/schema";
import type { ValidatedLineItemRow } from "./validation";

type Database = typeof db;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function listLineItemRows(database: Database, estimateId: string) {
  return database
    .select()
    .from(lineItems)
    .where(eq(lineItems.estimateId, estimateId))
    .orderBy(asc(lineItems.sort));
}

async function nextSort(tx: Tx, estimateId: string): Promise<number> {
  const [row] = await tx
    .select({ maxSort: sql<number | null>`max(${lineItems.sort})` })
    .from(lineItems)
    .where(eq(lineItems.estimateId, estimateId));
  return (row?.maxSort ?? -1) + 1;
}

// Every line item gets its own project-scoped cost_items row so it has the
// stable identity ARCHITECTURE.md §4/§7 requires for delta view (M2-15);
// reconciliation in M2 may later link a row to an existing cost item instead.
async function insertRow(
  tx: Tx,
  params: {
    projectId: string;
    estimateId: string;
    sectionId: string | null;
    sort: number;
  } & ValidatedLineItemRow,
) {
  const [costItem] = await tx
    .insert(costItems)
    .values({ projectId: params.projectId, key: crypto.randomUUID() })
    .returning({ id: costItems.id });
  if (!costItem) throw new Error("cost item insert did not return a row");

  const [lineItem] = await tx
    .insert(lineItems)
    .values({
      estimateId: params.estimateId,
      sectionId: params.sectionId,
      costItemId: costItem.id,
      sort: params.sort,
      description: params.description,
      quantity: params.quantity,
      unit: params.unit,
    })
    .returning();
  if (!lineItem) throw new Error("line item insert did not return a row");
  return lineItem;
}

export async function insertLineItem(
  database: Database,
  params: {
    projectId: string;
    estimateId: string;
    sectionId: string | null;
  } & ValidatedLineItemRow,
) {
  return database.transaction(async (tx) => {
    const sort = await nextSort(tx, params.estimateId);
    return insertRow(tx, { ...params, sort });
  });
}

// Scoped by estimateId as defense in depth alongside the service-layer
// tenancy guard, matching src/invitations/repository.ts.
export async function updateLineItemRow(
  database: Database,
  params: {
    id: string;
    estimateId: string;
    sectionId: string | null;
  } & ValidatedLineItemRow,
) {
  const [updated] = await database
    .update(lineItems)
    .set({
      sectionId: params.sectionId,
      description: params.description,
      quantity: params.quantity,
      unit: params.unit,
    })
    .where(and(eq(lineItems.id, params.id), eq(lineItems.estimateId, params.estimateId)))
    .returning();
  return updated ?? null;
}

export async function deleteLineItemRow(
  database: Database,
  params: { id: string; estimateId: string },
): Promise<boolean> {
  const result = await database
    .delete(lineItems)
    .where(and(eq(lineItems.id, params.id), eq(lineItems.estimateId, params.estimateId)))
    .returning({ id: lineItems.id });
  return result.length > 0;
}

export async function reorderLineItemRows(
  database: Database,
  params: { estimateId: string; orderedIds: string[] },
): Promise<void> {
  await database.transaction(async (tx) => {
    for (const [index, id] of params.orderedIds.entries()) {
      await tx
        .update(lineItems)
        .set({ sort: index })
        .where(and(eq(lineItems.id, id), eq(lineItems.estimateId, params.estimateId)));
    }
  });
}

// All-or-nothing: the caller must have already validated every row (paste
// is atomic per docs/DECISIONS.md); this transaction is the persistence
// half of that guarantee — any failure rolls back every row in the batch.
export async function insertPastedLineItems(
  database: Database,
  params: {
    projectId: string;
    estimateId: string;
    rows: ValidatedLineItemRow[];
  },
) {
  if (params.rows.length === 0) return [];
  return database.transaction(async (tx) => {
    let sort = await nextSort(tx, params.estimateId);
    const created = [];
    for (const row of params.rows) {
      created.push(
        await insertRow(tx, {
          projectId: params.projectId,
          estimateId: params.estimateId,
          sectionId: null,
          sort: sort++,
          ...row,
        }),
      );
    }
    return created;
  });
}
