import NextAuth from "next-auth";

import { createAuthConfig } from "@/auth/config";
import { createDatabaseAuthAdapter } from "@/auth/database-adapter";
import { parseAllowedEmails } from "@/auth/email-policy";
import {
  getTestAuthRuntime,
  isAuthTestMode,
  sendTestMagicLink,
} from "@/auth/test-runtime";

const testMode = isAuthTestMode();
// Prefer the real database adapter even in test mode whenever a database is
// available: authorization (src/auth/authorization.ts) looks users up in the
// real `users` table, so a user created only in the in-memory test adapter
// (no DATABASE_URL) would be unable to pass any firm/tenant guard. The
// in-memory adapter remains for hermetic, DB-less local runs of pure
// sign-in-flow tests.
const useInMemoryAdapter = testMode && !process.env.DATABASE_URL;
const testRuntime = useInMemoryAdapter ? getTestAuthRuntime() : null;

export const { auth, handlers, signIn, signOut } = NextAuth(
  createAuthConfig({
    adapter: testRuntime?.adapter ?? createDatabaseAuthAdapter(),
    allowedEmails: parseAllowedEmails(process.env.AUTH_ALLOWED_EMAILS),
    resendApiKey: process.env.AUTH_RESEND_KEY ?? "",
    emailFrom: process.env.AUTH_EMAIL_FROM ?? "Probable <auth@localhost>",
    sendVerificationRequest: testMode ? sendTestMagicLink : undefined,
  }),
);
