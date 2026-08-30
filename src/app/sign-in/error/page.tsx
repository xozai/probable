import Link from "next/link";

import styles from "../auth.module.css";

export default function SignInErrorPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Probable</p>
        <h1>We couldn&apos;t sign you in</h1>
        <p className={styles.description}>
          The address may not be approved, the link may have expired, or email delivery
          may be temporarily unavailable.
        </p>
        <Link className={styles.link} href="/sign-in">
          Try again
        </Link>
      </section>
    </main>
  );
}
