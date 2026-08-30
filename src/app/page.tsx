import styles from "./page.module.css";
import { SessionControls } from "./session-controls";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Engineer&apos;s Opinion of Probable Cost</p>
        <h1>Probable</h1>
        <p className={styles.summary}>
          Build consistent, regionally priced cost exhibits at every design milestone.
        </p>
        <p className={styles.status}>Walking skeleton ready.</p>
        <SessionControls />
      </section>
    </main>
  );
}
