"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import styles from "./page.module.css";

export function SessionControls() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className={styles.sessionStatus}>Checking session…</p>;
  }

  if (!session?.user?.email) {
    return (
      <Link className={styles.signIn} href="/sign-in">
        Sign in
      </Link>
    );
  }

  return (
    <div className={styles.session}>
      <p>Signed in as {session.user.email}</p>
      <button onClick={() => signOut({ redirectTo: "/sign-in" })} type="button">
        Sign out
      </button>
    </div>
  );
}
