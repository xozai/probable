import Link from "next/link";
import { redirect } from "next/navigation";

import { UnauthorizedError } from "@/auth/authorization";
import { listFirmsForCurrentUser } from "@/firms/service";

import { createFirmAction } from "./actions";
import styles from "./workspace.module.css";

export default async function FirmsPage() {
  let memberships;
  try {
    memberships = await listFirmsForCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in?callbackUrl=/firms");
    throw error;
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Probable</p>
        <h1>Firm workspace</h1>
        {memberships.length > 0 ? (
          <ul className={styles.firmList}>
            {memberships.map((firm) => (
              <li key={firm.id}>
                <Link href={`/firms/${firm.id}`}>{firm.name}</Link>
                <span>{firm.role}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Create your firm to start an estimate workspace.</p>
        )}

        <form action={createFirmAction} className={styles.form}>
          <label htmlFor="firm-name">Firm name</label>
          <input
            id="firm-name"
            name="name"
            minLength={2}
            maxLength={120}
            required
          />
          <button type="submit">Create firm</button>
        </form>
      </section>
    </main>
  );
}
