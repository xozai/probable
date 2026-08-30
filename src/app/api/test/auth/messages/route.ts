import { getTestAuthRuntime, isAuthTestMode } from "@/auth/test-runtime";

export async function GET() {
  if (!isAuthTestMode()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ messages: getTestAuthRuntime().messages });
}
