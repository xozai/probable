import { notFound, redirect } from "next/navigation";

import {
  FirmNotFoundError,
  requireFirmMember,
  UnauthorizedError,
} from "@/auth/authorization";

import styles from "../workspace.module.css";

export default async function FirmPage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = await params;
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

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Firm workspace</p>
        <h1>Workspace ready</h1>
        <p>
          Your access level is <strong>{access.role}</strong>.
        </p>
      </section>
    </main>
  );
}
