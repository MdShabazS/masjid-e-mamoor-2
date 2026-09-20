import { expect, test } from "@playwright/test";

test("web foundation renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Create Next App/);
});
