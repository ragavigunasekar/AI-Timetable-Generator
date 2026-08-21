import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";
import { attachErrorCollector } from "./utils/console-collector";

test.describe("Console Error and Uncaught Exception QA Suite", () => {
  test("Navigates core application pages without producing console errors or failed API requests", async ({ page }) => {
    const errors = attachErrorCollector(page);

    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("console");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const routes = ["/dashboard", "/teachers", "/subjects", "/classes", "/settings", "/allocations", "/timetable", "/profile"];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }

    // Filter for critical application errors
    const criticalErrors = errors.filter(
      (e) => e.type === "pageerror" || e.type === "responseerror"
    );

    expect(criticalErrors).toEqual([]);
  });
});
