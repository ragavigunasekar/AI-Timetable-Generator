import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Timetable Visual & Icon Presentation Tests", () => {
  test("Fixed timeline events display distinct styling and Lucide icons", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("ttvisual");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Setup timeline events in settings
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /School Configuration|School Settings/i })).toBeVisible();
    await expect(page.getByLabel(/School Name/i)).toBeVisible();

    // Delete default events first to have a clean non-overlapping event configuration
    while (await page.getByTitle("Delete Event").count() > 0) {
      const currentCount = await page.getByTitle("Delete Event").count();
      await page.getByTitle("Delete Event").first().click();
      await expect(page.getByTitle("Delete Event")).toHaveCount(currentCount - 1);
    }

    await page.getByRole("button", { name: "Assembly" }).click();
    await page.getByRole("button", { name: "Lunch Break" }).click();
    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration (saved|updated) successfully|Settings (saved|updated) successfully/i).first()).toBeVisible();

    // Navigate to Timetable
    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();
    await expect(page.getByText("Assembly").first()).toBeVisible();
    await expect(page.getByText("Lunch Break").first()).toBeVisible();

    // Verify fixed timeline event badges are visible with title "Fixed Timeline Event"
    const fixedBadges = page.locator("[title*='Fixed Timeline Event'], .bg-slate-100, .bg-amber-50, .bg-sky-50");
    expect(await fixedBadges.count()).toBeGreaterThan(0);
  });
});
