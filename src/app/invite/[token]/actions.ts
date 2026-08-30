"use server";

import { redirect } from "next/navigation";

import { acceptInvitation } from "@/invitations/service";

export async function acceptInvitationAction(token: string): Promise<void> {
  const result = await acceptInvitation(token);
  if (result.ok) {
    redirect(`/firms/${result.firmId}`);
  }
  redirect(`/invite/${token}/error?reason=${result.reason}`);
}
