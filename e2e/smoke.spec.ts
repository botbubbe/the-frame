import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("login page renders and user can authenticate", async ({ page }) => {
    // Navigate to login
    await page.goto("/login");

    // Verify login page renders
    await expect(page.locator("h1, h2, [data-testid='login-heading']")).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Login with test credentials
    await page.getByLabel(/email/i).fill("daniel@getjaxy.com");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Verify dashboard loads
    await page.waitForURL("**/dashboard**", { timeout: 10_000 });
    await expect(page).toHaveURL(/dashboard/);
  });
});
