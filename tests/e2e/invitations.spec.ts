import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { firmInvitations } from "@/db/schema";
import { hashInvitationToken } from "@/invitations/tokens";

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

async function signOut(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

async function createFirm(page: Page, name: string): Promise<string> {
  await page.goto("/firms");
  await page.getByLabel("Firm name").fill(name);
  await page.getByRole("button", { name: "Create firm" }).click();
  await expect(page).toHaveURL(/\/firms\/[0-9a-f-]+$/);
  const firmId = new URL(page.url()).pathname.split("/").pop();
  if (!firmId) throw new Error("Firm id missing from URL after creation");
  return firmId;
}

async function sendInvitation(page: Page, firmId: string, email: string): Promise<string> {
  await page.goto(`/firms/${firmId}/invitations`);
  await page.getByLabel("Invite by email").fill(email);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page).toHaveURL(/invited=/);
  await expect(page.getByText("Invitation sent.")).toBeVisible();

  const invitationsResponse = await page.request.get("/api/test/invitations/messages");
  const { messages } = (await invitationsResponse.json()) as TestInvitationMessageResponse;
  const invitation = [...messages].reverse().find((m) => m.email === email);
  if (!invitation) throw new Error(`No invitation email captured for ${email}`);
  return invitation.url;
}

test.describe.configure({ mode: "serial" });

// T-AC1-04 (below) backdates an invitation directly in the same Postgres the
// app under test uses; close the pool afterwards so the Playwright process
// doesn't hang on an open connection, matching
// src/invitations/repository.integration.test.ts's afterAll pattern.
test.afterAll(async () => {
  await db.$client.end();
});

let acceptedFirmId: string;
let acceptedInvitationUrl: string;

test("T-AC1-01/02: owner invites a firm member and the invitee accepts", async ({ page }) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");

  acceptedFirmId = await createFirm(page, "Oak Creek Civil");
  acceptedInvitationUrl = await sendInvitation(page, acceptedFirmId, "demo.invitee@example.test");

  await signOut(page);
  await signInViaMagicLink(page, "demo.invitee@example.test");

  await page.goto(acceptedInvitationUrl);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(new RegExp(`/firms/${acceptedFirmId}$`));
  await expect(page.getByText("Your access level is member")).toBeVisible();
});

test("T-AC1-03: re-opening an already-accepted invitation fails (single-use)", async ({
  page,
}) => {
  // demo.invitee already accepted this exact link in the previous test.
  await signInViaMagicLink(page, "demo.invitee@example.test");

  await page.goto(acceptedInvitationUrl);
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(page).toHaveURL(/\/invite\/[^/]+\/error\?reason=already_accepted/);
  await expect(page.getByText("This invitation has already been used.")).toBeVisible();
});

test("T-AC1-07: a member cannot reach the firm's invitations page", async ({ page }) => {
  // demo.invitee is a `member` of acceptedFirmId (owner-only page).
  await signInViaMagicLink(page, "demo.invitee@example.test");

  await page.goto(`/firms/${acceptedFirmId}/invitations`);
  await expect(page).toHaveURL(new RegExp(`/firms/${acceptedFirmId}$`));
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});

test("T-AC1-05: a revoked invitation fails on accept", async ({ page }) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");

  const firmId = await createFirm(page, "Revoke Test Firm");
  const invitationUrl = await sendInvitation(page, firmId, "demo.invitee@example.test");

  // We just landed back on the invitations list (?invited=...); the invite
  // is still pending, so its Revoke button is on this same page.
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page).toHaveURL(new RegExp(`/firms/${firmId}/invitations$`));
  await expect(page.getByText(/revoked/)).toBeVisible();

  await signOut(page);
  await signInViaMagicLink(page, "demo.invitee@example.test");

  await page.goto(invitationUrl);
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(page).toHaveURL(/\/invite\/[^/]+\/error\?reason=revoked/);
  await expect(page.getByText("This invitation has been revoked.")).toBeVisible();
});

test("T-AC1-08: accepting with an email different from the invited one fails", async ({
  page,
}) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");

  const firmId = await createFirm(page, "Mismatch Test Firm");
  // Invited email need not be a sign-in-allowed address; only the accepting
  // user's session email needs to be. This deliberately mismatches whoever
  // signs in to accept it below.
  const invitationUrl = await sendInvitation(page, firmId, "someone.else@example.test");

  await signOut(page);
  await signInViaMagicLink(page, "demo.invitee@example.test");

  await page.goto(invitationUrl);
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(page).toHaveURL(/\/invite\/[^/]+\/error\?reason=email_mismatch/);
  await expect(
    page.getByText(
      "This invitation was sent to a different email address than the one you're signed in with.",
    ),
  ).toBeVisible();
});

test("T-AC1-04: an expired invitation fails on accept", async ({ page }) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");

  const firmId = await createFirm(page, "Expiry Test Firm");
  const invitationUrl = await sendInvitation(page, firmId, "demo.invitee@example.test");

  // No production path backdates an invitation, so we reach into the same
  // Postgres the app under test uses to simulate ">7 days old" directly,
  // the same way src/invitations/repository.integration.test.ts does at the
  // repository layer. Here we drive it through the real accept route/UI
  // instead of calling the repository function directly.
  const token = new URL(invitationUrl).pathname.split("/").pop();
  if (!token) throw new Error("Invitation token missing from URL");
  const tokenHash = hashInvitationToken(token);
  const updated = await db
    .update(firmInvitations)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(firmInvitations.tokenHash, tokenHash))
    .returning({ id: firmInvitations.id });
  if (updated.length === 0) throw new Error("Failed to backdate invitation for test setup");

  await signOut(page);
  await signInViaMagicLink(page, "demo.invitee@example.test");

  await page.goto(invitationUrl);
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(page).toHaveURL(/\/invite\/[^/]+\/error\?reason=expired/);
  await expect(
    page.getByText("This invitation has expired. Ask the firm owner to send a new one."),
  ).toBeVisible();
});
