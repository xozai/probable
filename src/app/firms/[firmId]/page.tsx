import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { FlashCleanup } from "@/app/flash-cleanup";
import {
  FirmNotFoundError,
  requireFirmMember,
  UnauthorizedError,
} from "@/auth/authorization";
import { listProjects } from "@/projects/service";
import { createProjectAction } from "@/app/projects/actions";

import styles from "../workspace.module.css";

export default async function FirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ firmId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { firmId } = await params;
  const { error: errorMessage } = await searchParams;
  let access;
  try {
    access = await requireFirmMember(firmId);
  } catch (error) {
    if (error instanceof FirmNotFoundError) notFound();
    if (error instanceof UnauthorizedError) {
      redirect(`/sign-in?callbackUrl=/firms/${firmId}`);
    }
    throw error;
  }

  const firmProjects = await listProjects(firmId);
  const createProject = createProjectAction.bind(null, firmId);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <FlashCleanup active={Boolean(errorMessage)} />
        <p className={styles.eyebrow}>Firm workspace</p>
        <h1>Projects</h1>
        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <p>
          Your access level is <strong>{access.role}</strong>.
        </p>
        {access.role === "owner" ? (
          <p>
            <Link href={`/firms/${firmId}/sections`}>Edit section defaults</Link>
          </p>
        ) : null}
        {firmProjects.length ? (
          <ul className={styles.list}>
            {firmProjects.map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>{project.name}</Link>
                <span>{project.location || project.district || "No location added"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No projects yet.</p>
        )}
        <h2>Create a project</h2>
        <form action={createProject} className={styles.form}>
          <label>Name<input name="name" required maxLength={120} /></label>
          <label>Location<input name="location" maxLength={160} /></label>
          <label>District<input name="district" maxLength={80} /></label>
          <button type="submit">Create project</button>
        </form>
      </section>
    </main>
  );
}
