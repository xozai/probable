import { expect, test } from "@playwright/test";

test("renders the Probable walking skeleton", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Probable" })).toBeVisible();
  await expect(page.getByText("Walking skeleton ready.")).toBeVisible();
});
