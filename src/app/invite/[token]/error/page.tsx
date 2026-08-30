import Link from "next/link";

import styles from "../../../firms/workspace.module.css";

const MESSAGES: Record<string, string> = {
  not_found: "This invitation link isn't valid.",
  expired: "This invitation has expired. Ask the firm owner to send a new one.",
  revoked: "This invitation has been revoked.",
  already_accepted: "This invitation has already been used.",
  email_mismatch:
    "This invitation was sent to a different email address than the one you're signed in with.",
};

export default async function InviteErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGES[reason]) || "We couldn't accept this invitation.";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Firm workspace</p>
        <h1>Invitation not accepted</h1>
        <p>{message}</p>
        <Link className={styles.primaryLink} href="/firms">
          Go to your firms
        </Link>
      </section>
    </main>
  );
}
