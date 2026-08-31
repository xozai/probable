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
  const message = [...messages]
    .reverse()
    .find((candidate) => candidate.identifier === email.toLowerCase());
  if (!message) throw new Error(`No magic link captured for ${email}`);
  await page.goto(message.url);
}

test.describe.configure({ mode: "serial" });

test("priced line items render section and estimate totals from the shared calculation", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await signInViaMagicLink(page, "demo.engineer@example.test");
  await page.goto("/firms");
  await page.getByLabel("Firm name").fill(`Totals Civil ${Date.now()}`);
  await page.getByRole("button", { name: "Create firm" }).click();
  await expect(page).toHaveURL(/\/firms\/[0-9a-f-]+$/);

  await page.getByLabel("Name").fill("Totals project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Create estimate" }).click();
  await expect(page).toHaveURL(/\/estimates\/[0-9a-f-]+$/);

  await page.getByLabel("Description").fill("Excavation");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit", { exact: true }).fill("CY");
  await page.getByLabel("Section").selectOption({ label: "Earthwork" });
  await page.getByLabel("Unit price").fill("10.00");
  await page.getByRole("button", { name: "Add line item" }).click();

  await expect(page.getByText("$20.00")).toHaveCount(3);
  await expect(page.getByText("$2.00")).toBeVisible();
  await expect(page.getByText("$22.00")).toBeVisible();
  await expect(page.getByText("Earthwork subtotal")).toBeVisible();
  await expect(page.getByText(/unpriced .* excluded from totals/)).toHaveCount(0);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
