import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("School Settings QA Suite", () => {
  test.beforeEach(async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("settings");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/settings");
  });

  test("Configures realistic school day and persists after page reload", async ({ page }) => {
    // 1. Verify header
    await expect(page.getByRole("heading", { name: /School Configuration|School Settings/i })).toBeVisible();

    // 2. Configure School Timings
    const schoolNameInput = page.getByLabel(/School Name/i);
    await schoolNameInput.fill("Oakridge International School");

    const startTimeInput = page.getByLabel(/Start Time/i);
    await startTimeInput.fill("09:00");

    const endTimeInput = page.getByLabel(/End Time/i);
    await endTimeInput.fill("16:00");

    const periodDurationInput = page.getByLabel(/Period Duration/i);
    await periodDurationInput.fill("45");

    // 3. Save Settings
    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();

    // Verify success toast/notification
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully|School settings saved/i).first()).toBeVisible();

    // 4. Reload page and verify persistence
    await page.reload();
    await expect(schoolNameInput).toHaveValue("Oakridge International School");
    await expect(startTimeInput).toHaveValue("09:00");
    await expect(endTimeInput).toHaveValue("16:00");
    await expect(periodDurationInput).toHaveValue("45");
  });
});
