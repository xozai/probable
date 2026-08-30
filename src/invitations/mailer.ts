import { isAuthTestMode } from "../auth/test-runtime";

import { getTestInvitationMessages } from "./test-runtime";

export interface SendInvitationEmailParams {
  email: string;
  url: string;
}

// Same direct Resend HTTP call Auth.js's own Resend provider makes
// (@auth/core/providers/resend), reusing the AUTH_RESEND_KEY / AUTH_EMAIL_FROM
// env vars already configured for magic links, since this isn't an Auth.js
// sign-in email and can't go through next-auth's provider.
export async function sendInvitationEmail({
  email,
  url,
}: SendInvitationEmailParams): Promise<void> {
  if (isAuthTestMode()) {
    getTestInvitationMessages().push({ email, url });
    return;
  }

  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    throw new Error("AUTH_RESEND_KEY is required to send invitation email");
  }
  const from = process.env.AUTH_EMAIL_FROM ?? "Probable <auth@localhost>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "You're invited to join a firm on Probable",
      html: `<p>You've been invited to join a firm on Probable.</p><p><a href="${url}">Accept the invitation</a></p>`,
      text: `You've been invited to join a firm on Probable: ${url}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend error: ${JSON.stringify(await response.json())}`);
  }
}
