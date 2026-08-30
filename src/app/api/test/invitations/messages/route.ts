import { isAuthTestMode } from "@/auth/test-runtime";
import { getTestInvitationMessages } from "@/invitations/test-runtime";

export async function GET() {
  if (!isAuthTestMode()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ messages: getTestInvitationMessages() });
}
