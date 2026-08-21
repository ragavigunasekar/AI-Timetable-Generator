import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Accessibility QA Suite (Axe-Core)", () => {
  test("Login page accessibility scan", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("Register page accessibility scan", async ({ page }) => {
    await page.goto("/register");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("Dashboard & Settings accessibility scan", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("a11y");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const dashboardResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalDash = dashboardResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalDash).toEqual([]);

    await page.goto("/settings");
    const settingsResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalSettings = settingsResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalSettings).toEqual([]);
  });
});
