import { redirect } from "next/navigation";

import { auth } from "@/auth";

import styles from "../../firms/workspace.module.css";
import { acceptInvitationAction } from "./actions";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Firm workspace</p>
        <h1>Join your firm</h1>
        <p>
          Signed in as <strong>{session.user.email}</strong>. Accept the invitation to
          join the firm.
        </p>
        <form action={acceptInvitationAction.bind(null, token)} className={styles.form}>
          <button type="submit">Accept invitation</button>
        </form>
      </section>
    </main>
  );
}
