import styles from "../auth.module.css";

export default function CheckEmailPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Probable</p>
        <h1>Check your email</h1>
        <p className={styles.description}>
          The sign-in link is single-use and expires in 24 hours.
        </p>
      </section>
    </main>
  );
}
