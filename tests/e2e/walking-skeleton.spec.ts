import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Composes the same real-UI interaction patterns already established by the
// other e2e specs (signInViaMagicLink from auth/invitations/line-items/
// totals; createFirm/createProject/createEstimate from line-items/totals;
// invitation flow from invitations.spec.ts) into one continuous journey
// through the M1 walking skeleton, per docs/product/ISSUES.md M1-13 and the
// fixture documented in product/tests/fixtures/README.md. Each spec file in
// this suite defines its own copies of these helpers rather than sharing a
// module — matching that existing convention instead of introducing a new
// one for this single test.

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

async function createProject(page: Page, firmId: string, name: string): Promise<string> {
  await page.goto(`/firms/${firmId}`);
  await page.getByLabel("Name").fill(name);
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

test("walking skeleton: sign-in, firm/member, project, manual/pasted estimate, total, PDF", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  // 1. Owner signs in and creates the firm.
  await signInViaMagicLink(page, "demo.engineer@example.test");
  const firmId = await createFirm(page, `M1 Walking Skeleton ${Date.now()}`);

  // 2. Owner edits the firm's section defaults (owner-only), adding Traffic
  // Control to the M1-08 seeded set without disturbing Earthwork/Paving,
  // which the fixture line items below are priced into.
  await page.goto(`/firms/${firmId}/sections`);
  const sectionsField = page.getByLabel("Sections");
  const seededSections = await sectionsField.inputValue();
  await sectionsField.fill(`${seededSections}\nTraffic Control`);
  await page.getByRole("button", { name: "Save section defaults" }).click();
  await expect(page).toHaveURL(new RegExp(`/firms/${firmId}/sections$`));
  await expect(sectionsField).toHaveValue(new RegExp("Traffic Control$"));

  // 3. Owner invites a second user; that user accepts as a member.
  await page.goto(`/firms/${firmId}/invitations`);
  await page.getByLabel("Invite by email").fill("demo.invitee@example.test");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Invitation sent.")).toBeVisible();
  const invitationsResponse = await page.request.get("/api/test/invitations/messages");
  const { messages } = (await invitationsResponse.json()) as TestInvitationMessageResponse;
  const invitation = [...messages].reverse().find((m) => m.email === "demo.invitee@example.test");
  if (!invitation) throw new Error("No invitation email captured for demo.invitee@example.test");

  await signOut(page);
  await signInViaMagicLink(page, "demo.invitee@example.test");
  await page.goto(invitation.url);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(new RegExp(`/firms/${firmId}$`));
  await expect(page.getByText("Your access level is member")).toBeVisible();

  // 4. The invited member builds the project, estimate, and fixture line
  // items (product/tests/fixtures/README.md) — proving a plain member, not
  // just the owner, can drive the full build flow.
  const projectId = await createProject(page, firmId, "Fixture Roadway");
  await createEstimate(page, projectId);

  // Manual line item, priced and sectioned at creation.
  await page.getByLabel("Description").fill("Excavation");
  await page.getByLabel("Quantity").fill("500");
  await page.getByLabel("Unit", { exact: true }).fill("CY");
  await page.getByLabel("Section").selectOption({ label: "Earthwork" });
  await page.getByLabel("Unit price").fill("12.50");
  await page.getByRole("button", { name: "Add line item" }).click();
  await expect(page.locator("table tbody tr")).toHaveCount(1);

  // Pasted line item (AC3 shape: description, quantity, unit only — no
  // price column), priced and sectioned afterward through the row.
  await page.getByLabel("Paste line items").fill("Base course\t1200\tSY");
  await expect(page.locator("ul li").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Save pasted rows" }).click();
  const dataRows = page.locator("table tbody tr");
  await expect(dataRows).toHaveCount(2);

  // Paste always appends after existing rows (repository assigns
  // sequential sort values), so the pasted row is deterministically second;
  // `.filter({ hasText })` would not work here since the description lives
  // in an <input value>, which isn't part of the row's textContent.
  const pastedRow = dataRows.nth(1);
  await pastedRow.getByLabel("Section").selectOption({ label: "Paving" });
  await pastedRow.getByLabel("Unit price").fill("8.25");
  await pastedRow.getByLabel("Unit price").blur();
  // Totals re-render from local state immediately (see line-items.spec.ts's
  // note on the same pattern), but the PDF request below reads the estimate
  // straight from the database; give the pending server action time to
  // land before navigating away, or its POST can race the link click.
  await page.waitForTimeout(300);

  // 5. Totals match the documented fixture exactly. Each section here has
  // exactly one line item, so its extension equals its section subtotal —
  // both values render, hence the count-of-2 rather than toBeVisible().
  await expect(page.getByText("$6,250.00")).toHaveCount(2); // Excavation extension + Earthwork subtotal
  await expect(page.getByText("$9,900.00")).toHaveCount(2); // Base course extension + Paving subtotal
  await expect(page.getByText("Earthwork subtotal")).toBeVisible();
  await expect(page.getByText("Paving subtotal")).toBeVisible();
  await expect(page.getByText("$16,150.00")).toBeVisible(); // Subtotal
  await expect(page.getByText("Contingency (10.00%)")).toBeVisible();
  await expect(page.getByText("$1,615.00")).toBeVisible(); // Contingency
  await expect(page.getByText("$17,765.00")).toBeVisible(); // Total
  await expect(page.getByText(/unpriced .* excluded from totals/)).toHaveCount(0);

  // 6. PDF exhibit request.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF exhibit" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fixture-roadway-30-percent-rev-1.pdf");
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("PDF download did not produce a local file");
  const pdf = await readFile(downloadPath);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  // No client errors or dev-overlay failures anywhere in the journey.
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
