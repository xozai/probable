import { requestMagicLink } from "@/auth/actions";

import styles from "./auth.module.css";

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Probable</p>
        <h1>Sign in</h1>
        <p className={styles.description}>
          Enter an approved work email. We&apos;ll send a single-use sign-in link.
        </p>
        <form className={styles.form} action={requestMagicLink}>
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <button className={styles.button} type="submit">
            Email me a sign-in link
          </button>
        </form>
      </section>
    </main>
  );
}
