import { expect, test, type Page } from "@playwright/test";

interface TestAuthMessageResponse {
  messages: Array<{ identifier: string; url: string }>;
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

async function createProject(page: Page, firmId: string, name: string): Promise<string> {
  await page.goto(`/firms/${firmId}`);
  await page.getByLabel("Name").first().fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  const projectId = new URL(page.url()).pathname.split("/").pop();
  if (!projectId) throw new Error("Project id missing from URL after creation");
  return projectId;
}

async function createEstimate(page: Page, projectId: string): Promise<string> {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole("button", { name: "Create estimate" }).click();
  await expect(page).toHaveURL(/\/estimates\/[0-9a-f-]+$/);
  const estimateId = new URL(page.url()).pathname.split("/").pop();
  if (!estimateId) throw new Error("Estimate id missing from URL after creation");
  return estimateId;
}

test.describe.configure({ mode: "serial" });

// T-AC9-01: a member of firm A requesting firm B's project/estimate by
// direct ID must get a real 404 (not 403, not the data). This spec is
// self-contained (its own two firms) so it doesn't depend on execution
// order relative to other spec files.
test("T-AC9-01: cross-firm project and estimate reads 404 with no data leaked", async ({
  page,
}) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");
  const firmAId = await createFirm(page, "Tenant Isolation Firm A");
  const projectAId = await createProject(page, firmAId, "Firm A Secret Project");
  const estimateAId = await createEstimate(page, projectAId);
  await signOut(page);

  await signInViaMagicLink(page, "demo.invitee@example.test");
  await createFirm(page, "Tenant Isolation Firm B");

  const projectResponse = await page.goto(`/projects/${projectAId}`);
  expect(projectResponse?.status()).toBe(404);
  await expect(page.getByText("Firm A Secret Project")).toHaveCount(0);

  const estimateResponse = await page.goto(`/estimates/${estimateAId}`);
  expect(estimateResponse?.status()).toBe(404);
  await expect(page.getByText("Firm A Secret Project")).toHaveCount(0);
});
