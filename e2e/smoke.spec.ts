import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("login page renders and user can authenticate", async ({ page }) => {
    // Navigate to login
    await page.goto("/login");

    // Verify login page renders (CardTitle is a div, not h1/h2)
    await expect(page.getByText("The Frame")).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Login with test credentials
    await page.locator('#email').fill("daniel@getjaxy.com");
    await page.locator('#password').fill("jaxy2026!");
    await page.locator('button[type="submit"]').click();

    // Verify dashboard loads
    await page.waitForURL("**/dashboard**", { timeout: 10_000 });
    await expect(page).toHaveURL(/dashboard/);
  });
});
