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
const testRuntime = testMode ? getTestAuthRuntime() : null;

export const { auth, handlers, signIn, signOut } = NextAuth(
  createAuthConfig({
    adapter: testRuntime?.adapter ?? createDatabaseAuthAdapter(),
    allowedEmails: parseAllowedEmails(process.env.AUTH_ALLOWED_EMAILS),
    resendApiKey: process.env.AUTH_RESEND_KEY ?? "",
    emailFrom: process.env.AUTH_EMAIL_FROM ?? "Probable <auth@localhost>",
    sendVerificationRequest: testMode ? sendTestMagicLink : undefined,
  }),
);
