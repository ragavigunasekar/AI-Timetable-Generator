import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Network Failure & API Error Handling QA Suite", () => {
  test("Gracefully handles API 500 failure and displays friendly user message", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("netfail");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Mock /api/teachers endpoint to return 500 Internal Server Error
    await page.route("**/api/teachers", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Internal Server Error" }),
      });
    });

    await page.goto("/teachers");

    // Verify friendly error message is displayed and NO raw stack traces
    await expect(page.getByText(/Unable to load teachers|Something went wrong/i).first()).toBeVisible();
    await expect(page.getByText(/at Module\./i)).not.toBeVisible();
  });
});
