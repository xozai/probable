import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { UnauthorizedError } from "@/auth/authorization";
import { updateEstimateAction } from "@/app/projects/actions";
import { listLineItems } from "@/line-items/service";
import { EstimateNotFoundError, getEstimate } from "@/projects/service";
import { ESTIMATE_MILESTONES } from "@/projects/types";

import { LineItemGrid } from "./line-items/line-item-grid";
import styles from "../../firms/workspace.module.css";

export default async function EstimatePage({ params }: { params: Promise<{ estimateId: string }> }) {
  const { estimateId } = await params;
  let row;
  let lineItems;
  try {
    row = await getEstimate(estimateId);
    lineItems = await listLineItems(estimateId);
  } catch (error) {
    if (error instanceof EstimateNotFoundError) notFound();
    if (error instanceof UnauthorizedError) redirect(`/sign-in?callbackUrl=/estimates/${estimateId}`);
    throw error;
  }
  const saveEstimate = updateEstimateAction.bind(null, estimateId);
  return <main className={styles.page}><section className={styles.card}>
    <p className={styles.eyebrow}>Estimate · {row.project.name}</p>
    <h1>{row.estimate.milestone === "custom" ? "Custom" : `${row.estimate.milestone}%`} milestone · revision {row.estimate.revision}</h1>
    <form action={saveEstimate} className={styles.form}>
      <label>Milestone<select name="milestone" defaultValue={row.estimate.milestone}>{ESTIMATE_MILESTONES.map((value) => <option key={value} value={value}>{value}{value === "custom" ? "" : "%"}</option>)}</select></label>
      <label>Revision<input name="revision" type="number" min="1" step="1" defaultValue={row.estimate.revision} required /></label>
      <label>Label<input name="label" maxLength={120} defaultValue={row.estimate.label ?? ""} /></label>
      <label>Contingency (%)<input name="contingencyPct" type="number" min="0" max="100" step="0.01" defaultValue={row.estimate.contingencyPct} required /></label>
      <button type="submit">Save estimate</button>
    </form>
    <p><Link href={`/projects/${row.project.id}`}>Back to project</Link></p>
  </section>
  <LineItemGrid estimateId={estimateId} initialItems={lineItems} />
  </main>;
}
