import { expect, test, type Page } from "@playwright/test";

interface TestAuthMessageResponse {
  messages: Array<{ identifier: string; url: string }>;
}

// Mirrors tests/e2e/invitations.spec.ts's helper exactly (magic-link sign-in
// via the test-only auth message inbox).
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

async function createEstimate(
  page: Page,
  projectId: string,
  options: { milestone?: string } = {},
): Promise<string> {
  await page.goto(`/projects/${projectId}`);
  if (options.milestone) {
    await page.getByLabel("Milestone").selectOption(options.milestone);
  }
  await page.getByRole("button", { name: "Create estimate" }).click();
  await expect(page).toHaveURL(/\/estimates\/[0-9a-f-]+$/);
  const estimateId = new URL(page.url()).pathname.split("/").pop();
  if (!estimateId) throw new Error("Estimate id missing from URL after creation");
  return estimateId;
}

test.describe.configure({ mode: "serial" });

let firmId: string;
let projectId: string;
let manualEstimateId: string;

test("manual add/edit/delete a line item persists through the real UI", async ({ page }) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");

  firmId = await createFirm(page, `Grid QA Firm ${Date.now()}`);
  projectId = await createProject(page, firmId, "Grid Test Project");
  manualEstimateId = await createEstimate(page, projectId);

  // Add.
  await page.getByLabel("Description").fill("Clearing and grubbing");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit").fill("LS");
  await page.getByRole("button", { name: "Add line item" }).click();

  const row = page.locator("table tbody tr").first();
  await expect(row).toBeVisible();
  await expect(row.getByLabel("Description")).toHaveValue("Clearing and grubbing");
  await expect(row.getByLabel("Quantity")).toHaveValue("1.000");
  await expect(row.getByLabel("Unit")).toHaveValue("LS");

  // Edit: change the description and blur to commit, then reload to prove
  // it was persisted server-side, not just held in local state.
  await row.getByLabel("Description").fill("Clearing and grubbing, revised");
  await row.getByLabel("Description").blur();
  await page.waitForTimeout(300); // let the pending server action settle
  await page.reload();

  const reloadedRow = page.locator("table tbody tr").first();
  await expect(reloadedRow.getByLabel("Description")).toHaveValue("Clearing and grubbing, revised");

  // Delete.
  await reloadedRow.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No line items yet.")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});

test("T-AC3-01: pasting 5 valid TSV rows creates matching line items", async ({ page }) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");
  await page.goto(`/estimates/${manualEstimateId}`);
  await expect(page.getByText("No line items yet.")).toBeVisible();

  const validRows: Array<[string, string, string]> = [
    ["Clearing and grubbing", "1", "LS"],
    ["Excavation", "500", "CY"],
    ["Base course", "1200", "SY"],
    ["Curb and gutter", "800", "LF"],
    ["Sidewalk", "300", "SY"],
  ];
  const pasteText = validRows.map((r) => r.join("\t")).join("\n");

  await page.getByLabel("Paste line items").fill(pasteText);

  const stagedItems = page.locator("ul li");
  await expect(stagedItems).toHaveCount(5);
  await expect(page.locator("ul li").getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "Save pasted rows" }).click();

  const dataRows = page.locator("table tbody tr");
  await expect(dataRows).toHaveCount(5);
  // Rows persist in paste order (repository assigns sequential sort values
  // in the order the validated rows array was built).
  for (let i = 0; i < validRows.length; i++) {
    const [description, quantity, unit] = validRows[i]!;
    const row = dataRows.nth(i);
    await expect(row.getByLabel("Description")).toHaveValue(description);
    await expect(row.getByLabel("Quantity")).toHaveValue(Number(quantity).toFixed(3));
    await expect(row.getByLabel("Unit")).toHaveValue(unit);
  }

  // Staged preview clears after a successful save.
  await expect(page.locator("ul li")).toHaveCount(0);
});

test("T-AC3-02: bad rows in a paste block the save; correcting them then saves exactly the valid set", async ({
  page,
}) => {
  await signInViaMagicLink(page, "demo.engineer@example.test");

  // Isolated estimate so this test's row counts aren't entangled with the
  // previous test's 5 committed rows.
  await createEstimate(page, projectId, { milestone: "60" });
  await expect(page.getByText("No line items yet.")).toBeVisible();

  const badPasteText = [
    "Mobilization\t1\tLS",
    "Erosion control\tabc\tLF", // bad: non-numeric quantity
    "Signage\t20\tEA",
    "Striping\t150\t", // bad: missing unit
    "Guardrail\t400\tLF",
  ].join("\n");

  await page.getByLabel("Paste line items").fill(badPasteText);

  await expect(page.locator("ul li")).toHaveCount(5);
  await expect(page.locator("ul li").getByRole("alert")).toHaveCount(2);

  const saveButton = page.getByRole("button", { name: "Save pasted rows" });
  await expect(saveButton).toBeDisabled();

  // A disabled button can't be clicked by a real user; force-click anyway to
  // prove the app-level guard (not just Playwright's disabled check) blocks
  // the save, then confirm no line items exist.
  await saveButton.click({ force: true }).catch(() => undefined);
  await expect(page.getByText("No line items yet.")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);

  // Correct both bad rows in place.
  const fixedPasteText = [
    "Mobilization\t1\tLS",
    "Erosion control\t250\tLF",
    "Signage\t20\tEA",
    "Striping\t150\tSY",
    "Guardrail\t400\tLF",
  ].join("\n");

  await page.getByLabel("Paste line items").fill(fixedPasteText);
  await expect(page.locator("ul li").getByRole("alert")).toHaveCount(0);
  await expect(saveButton).toBeEnabled();

  await saveButton.click();

  const dataRows = page.locator("table tbody tr");
  await expect(dataRows).toHaveCount(5);
  await expect(page.locator("ul li")).toHaveCount(0);
});
