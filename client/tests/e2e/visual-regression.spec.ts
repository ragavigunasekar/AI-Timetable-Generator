import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Visual Snapshot QA Suite", () => {
  test("Captures visual snapshot of Login page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login-page.png", { maxDiffPixelRatio: 0.1 });
  });

  test("Captures visual snapshot of Register page", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("register-page.png", { maxDiffPixelRatio: 0.1 });
  });

  test("Captures visual snapshot of Dashboard", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("visualsnap");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("dashboard-page.png", { maxDiffPixelRatio: 0.1 });
  });
});
