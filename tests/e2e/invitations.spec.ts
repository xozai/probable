import { expect, test, type Page } from "@playwright/test";

interface TestAuthMessageResponse {
  messages: Array<{ identifier: string; url: string }>;
}

interface TestInvitationMessageResponse {
  messages: Array<{ email: string; url: string }>;
}

async function signInViaMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page).toHaveURL(/\/sign-in\/check-email/);

  const response = await page.request.get("/api/test/auth/messages");
  const { messages } = (await response.json()) as TestAuthMessageResponse;
  const normalized = email.toLowerCase();
  const message = [...messages].reverse().find((m) => m.identifier === normalized);
  if (!message) throw new Error(`No magic link captured for ${email}`);
  await page.goto(message.url);
}

test.describe.configure({ mode: "serial" });

test("owner invites a firm member and the invitee accepts", async ({ page }) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");

  await page.goto("/firms");
  await page.getByLabel("Firm name").fill("Oak Creek Civil");
  await page.getByRole("button", { name: "Create firm" }).click();
  await expect(page).toHaveURL(/\/firms\/[0-9a-f-]+$/);
  const firmId = new URL(page.url()).pathname.split("/").pop();

  await page.goto(`/firms/${firmId}/invitations`);
  await page.getByLabel("Invite by email").fill("demo.invitee@example.test");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page).toHaveURL(/invited=/);
  await expect(page.getByText("Invitation sent.")).toBeVisible();

  const invitationsResponse = await page.request.get("/api/test/invitations/messages");
  const { messages } = (await invitationsResponse.json()) as TestInvitationMessageResponse;
  const invitation = [...messages]
    .reverse()
    .find((m) => m.email === "demo.invitee@example.test");
  if (!invitation) throw new Error("No invitation email captured");

  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  await signInViaMagicLink(page, "demo.invitee@example.test");

  await page.goto(invitation.url);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(new RegExp(`/firms/${firmId}$`));
  await expect(page.getByText("Your access level is member")).toBeVisible();
});
