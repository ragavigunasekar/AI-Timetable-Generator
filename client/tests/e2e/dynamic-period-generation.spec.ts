import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Dynamic Period Generation QA Suite", () => {
  test("Scheduler calculates teaching slots dynamically around timeline events", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("dynamic");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to School Settings
    await page.goto("/settings");
    await page.getByLabel(/Start Time/i).fill("09:00");
    await page.getByLabel(/End Time/i).fill("16:00");
    await page.getByLabel(/Period Duration/i).fill("45");

    // Delete default events first for a clean non-overlapping configuration
    const deleteButtons = page.getByTitle("Delete Event");
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
    }

    // Add Assembly & Lunch
    await page.getByRole("button", { name: "Assembly" }).click();
    await page.getByRole("button", { name: "Lunch Break" }).click();

    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    // Navigate to Timetable Generator
    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();

    // Verify fixed timeline event slots exist in the table
    await expect(page.getByText("Assembly").first()).toBeVisible();
    await expect(page.getByText("Lunch Break").first()).toBeVisible();

    // Verify derived teaching period slots exist
    await expect(page.getByText("Period 1").first()).toBeVisible();
  });
});
