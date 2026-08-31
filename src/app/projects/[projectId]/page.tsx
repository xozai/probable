import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { FlashCleanup } from "@/app/flash-cleanup";
import { FirmNotFoundError, UnauthorizedError } from "@/auth/authorization";
import { createEstimateAction, updateProjectAction } from "@/app/projects/actions";
import { getProject, ProjectNotFoundError } from "@/projects/service";
import { ESTIMATE_MILESTONES } from "@/projects/types";

import styles from "../../firms/workspace.module.css";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { projectId } = await params;
  const { error: errorMessage } = await searchParams;
  let project;
  try {
    project = await getProject(projectId);
  } catch (error) {
    if (error instanceof ProjectNotFoundError || error instanceof FirmNotFoundError) notFound();
    if (error instanceof UnauthorizedError) redirect(`/sign-in?callbackUrl=/projects/${projectId}`);
    throw error;
  }
  const saveProject = updateProjectAction.bind(null, projectId);
  const addEstimate = createEstimateAction.bind(null, projectId);

  return <main className={styles.page}><section className={styles.card}>
    <FlashCleanup active={Boolean(errorMessage)} />
    <p className={styles.eyebrow}>Project workspace</p>
    <h1>{project.name}</h1>
    {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
    <form action={saveProject} className={styles.form}>
      <label>Name<input name="name" required maxLength={120} defaultValue={project.name} /></label>
      <label>Location<input name="location" maxLength={160} defaultValue={project.location ?? ""} /></label>
      <label>District<input name="district" maxLength={80} defaultValue={project.district ?? ""} /></label>
      <button type="submit">Save project</button>
    </form>
    <h2>Estimates</h2>
    {project.estimates.length ? <ul className={styles.list}>{project.estimates.map((estimate) => <li key={estimate.id}>
      <Link href={`/estimates/${estimate.id}`}>{estimate.milestone === "custom" ? "Custom" : `${estimate.milestone}%`} · revision {estimate.revision}</Link>
      <span>{estimate.label || estimate.status}</span>
    </li>)}</ul> : <p>No estimates yet.</p>}
    <h2>Create an estimate</h2>
    <form action={addEstimate} className={styles.form}>
      <label>Milestone<select name="milestone" defaultValue="30">{ESTIMATE_MILESTONES.map((value) => <option key={value} value={value}>{value}{value === "custom" ? "" : "%"}</option>)}</select></label>
      <label>Revision<input name="revision" type="number" min="1" step="1" defaultValue="1" required /></label>
      <label>Label<input name="label" maxLength={120} /></label>
      <label>Contingency (%)<input name="contingencyPct" type="number" min="0" max="100" step="0.01" defaultValue="10.00" required /></label>
      <button type="submit">Create estimate</button>
    </form>
  </section></main>;
}
