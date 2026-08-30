import type { Adapter } from "next-auth/adapters";
import type { NextAuthConfig } from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import Resend from "next-auth/providers/resend";

import { isEmailAllowed, normalizeEmail } from "./email-policy";

export interface AuthConfigDependencies {
  adapter: Adapter;
  allowedEmails: ReadonlySet<string>;
  resendApiKey: string;
  emailFrom: string;
  sendVerificationRequest?: EmailConfig["sendVerificationRequest"];
}

export function createAuthConfig({
  adapter,
  allowedEmails,
  resendApiKey,
  emailFrom,
  sendVerificationRequest,
}: AuthConfigDependencies): NextAuthConfig {
  const provider = Resend({
    apiKey: resendApiKey,
    from: emailFrom,
    normalizeIdentifier: normalizeEmail,
  });

  if (sendVerificationRequest) {
    provider.sendVerificationRequest = sendVerificationRequest;
  }

  return {
    adapter,
    session: { strategy: "jwt" },
    providers: [provider],
    pages: {
      signIn: "/sign-in",
      verifyRequest: "/sign-in/check-email",
      error: "/sign-in/error",
    },
    callbacks: {
      redirect({ url, baseUrl }) {
        const configuredOrigin = process.env.AUTH_URL ?? baseUrl;
        const destination = new URL(url, configuredOrigin);
        return destination.origin === new URL(configuredOrigin).origin
          ? destination.toString()
          : configuredOrigin;
      },
      signIn({ user }) {
        return isEmailAllowed(user.email, allowedEmails);
      },
    },
  };
}
