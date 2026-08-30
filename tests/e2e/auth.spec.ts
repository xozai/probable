import { expect, test } from "@playwright/test";

interface TestMessageResponse {
  messages: Array<{ identifier: string; url: string }>;
}

test.describe.configure({ mode: "serial" });

test("approved email signs in by magic link and signs out", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill("Demo.Engineer@Example.Test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();

  await expect(page).toHaveURL(/\/sign-in\/check-email/);
  const response = await page.request.get("/api/test/auth/messages");
  expect(response.ok()).toBe(true);
  const { messages } = (await response.json()) as TestMessageResponse;
  const message = messages.at(-1);
  expect(message?.identifier).toBe("demo.engineer@example.test");
  const magicLink = new URL(message?.url ?? "about:blank");
  expect(magicLink.host).toBe("127.0.0.1:3000");
  expect(magicLink.searchParams.get("callbackUrl")).toBe("http://127.0.0.1:3000/");

  const callbackResponse = await page.goto(message?.url ?? "about:blank");
  expect(callbackResponse?.ok()).toBe(true);
  expect(new URL(page.url()).host).toBe("127.0.0.1:3000");
  expect(
    (await page.context().cookies()).some((cookie) =>
      cookie.name.includes("authjs.session-token"),
    ),
  ).toBe(true);
  const sessionResponse = await page.request.get("/api/auth/session");
  expect(await sessionResponse.json()).toMatchObject({
    user: { email: "demo.engineer@example.test" },
  });
  expect(
    await page.evaluate(() => fetch("/api/auth/session").then((response) => response.json())),
  ).toMatchObject({ user: { email: "demo.engineer@example.test" } });
  await page.reload();
  await expect(page.getByText("Signed in as demo.engineer@example.test")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("unapproved email is handled without sending mail", async ({ page }) => {
  await page.goto("/sign-in");
  const before = await page.request.get("/api/test/auth/messages");
  const beforeMessages = ((await before.json()) as TestMessageResponse).messages.length;

  await page.getByLabel("Work email").fill("not-approved@example.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();

  await expect(page).toHaveURL(/\/sign-in\/error/);
  await expect(page.getByRole("heading", { name: "We couldn't sign you in" })).toBeVisible();
  const after = await page.request.get("/api/test/auth/messages");
  const afterMessages = ((await after.json()) as TestMessageResponse).messages.length;
  expect(afterMessages).toBe(beforeMessages);
});
