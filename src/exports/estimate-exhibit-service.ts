import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { firms } from "../db/schema";
import { listLineItems } from "../line-items/service";
import { getEstimate } from "../projects/service";
import { listEstimateSections } from "../sections/service";
import {
  buildEstimateExhibit,
  type EstimateExhibit,
} from "./estimate-exhibit";

export async function loadEstimateExhibit(estimateId: string): Promise<EstimateExhibit> {
  const { estimate, project } = await getEstimate(estimateId);
  const [sections, lineItems, firmRows] = await Promise.all([
    listEstimateSections(estimateId),
    listLineItems(estimateId),
    db.select().from(firms).where(eq(firms.id, project.firmId)).limit(1),
  ]);
  const firm = firmRows[0];
  if (!firm) throw new Error("Firm disappeared after estimate authorization");
  return buildEstimateExhibit({ firm, project, estimate, sections, lineItems });
}
