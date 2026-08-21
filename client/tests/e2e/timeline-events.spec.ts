import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Timeline Events QA Suite", () => {
  test.beforeEach(async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("timeline");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/settings");
  });

  test("Creates, edits, deletes, and persists Daily Timeline Events", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Daily Timeline Events" })).toBeVisible();

    // 1. Delete default events first if any to have a clean slate
    const deleteButtons = page.getByTitle("Delete Event");
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
    }

    // 2. Add Assembly preset event
    await page.getByRole("button", { name: "Assembly" }).click();
    const firstTitleInput = page.getByPlaceholder("e.g. Morning Assembly").first();
    await firstTitleInput.clear();
    await firstTitleInput.fill("Morning Assembly");

    // 3. Add Custom Event
    await page.getByRole("button", { name: "Add Event" }).click();
    const secondTitleInput = page.getByPlaceholder("e.g. Morning Assembly").nth(1);
    await secondTitleInput.clear();
    await secondTitleInput.fill("Robotics Club");

    // Set non-overlapping timing for Robotics Club (14:30 to 15:15)
    const startInputs = page.locator("input[type='time']");
    const endInputs = page.locator("input[type='time']");
    await startInputs.nth(2).fill("14:30"); // idx 2 is start of 2nd event
    await endInputs.nth(3).fill("15:15");   // idx 3 is end of 2nd event

    // 4. Save Configuration
    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    // 5. Reload page & verify persistence
    await page.reload();
    await expect(page.getByPlaceholder("e.g. Morning Assembly").first()).toHaveValue("Morning Assembly");
    await expect(page.getByPlaceholder("e.g. Morning Assembly").nth(1)).toHaveValue("Robotics Club");

    // 6. Delete an event
    await page.getByTitle("Delete Event").nth(1).click(); // Delete Robotics Club

    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    await page.reload();
    await expect(page.getByPlaceholder("e.g. Morning Assembly")).toHaveCount(1);
    await expect(page.getByPlaceholder("e.g. Morning Assembly").first()).toHaveValue("Morning Assembly");
  });
});
