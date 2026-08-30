import { getTestAuthRuntime } from "@/auth/test-runtime";

export async function GET() {
  if (process.env.AUTH_TEST_MODE !== "true") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ messages: getTestAuthRuntime().messages });
}
