import { notFound, redirect } from "next/navigation";

import { FlashCleanup } from "@/app/flash-cleanup";
import {
  FirmForbiddenError,
  FirmNotFoundError,
  requireFirmOwner,
  UnauthorizedError,
} from "@/auth/authorization";
import { listFirmSectionTemplates } from "@/sections/service";

import styles from "../../workspace.module.css";
import { updateSectionTemplatesAction } from "./actions";

export default async function FirmSectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ firmId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { firmId } = await params;
  const { error: errorMessage } = await searchParams;
  let templates;
  try {
    await requireFirmOwner(firmId);
    templates = await listFirmSectionTemplates(firmId);
  } catch (error) {
    if (error instanceof FirmNotFoundError) notFound();
    if (error instanceof FirmForbiddenError) redirect(`/firms/${firmId}`);
    if (error instanceof UnauthorizedError) {
      redirect(`/sign-in?callbackUrl=/firms/${firmId}/sections`);
    }
    throw error;
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <FlashCleanup active={Boolean(errorMessage)} />
        <p className={styles.eyebrow}>Firm settings</p>
        <h1>Estimate section defaults</h1>
        <p>Enter one section per line. New estimates receive a snapshot of this ordered list.</p>
        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <form
          action={updateSectionTemplatesAction.bind(null, firmId)}
          className={styles.form}
        >
          <label htmlFor="sections">Sections</label>
          <textarea
            id="sections"
            name="sections"
            rows={10}
            defaultValue={templates.map((template) => template.name).join("\n")}
            required
          />
          <button type="submit">Save section defaults</button>
        </form>
      </section>
    </main>
  );
}
