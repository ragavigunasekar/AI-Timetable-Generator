import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Different Timing Scenarios QA Suite", () => {
  test.beforeEach(async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("scenario");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Scenario A: Standard 09:00 -> 16:00 school schedule", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel(/Start Time/i).fill("09:00");
    await page.getByLabel(/End Time/i).fill("16:00");
    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();
  });

  test("Scenario B: Non-standard timings (Assembly 09:00-09:20, Break 1 11:15-11:20, Lunch 12:10-12:40, Break 2 14:20-14:25)", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel(/Start Time/i).fill("09:00");
    await page.getByLabel(/End Time/i).fill("15:30");

    // Delete default events first for a clean configuration
    const deleteButtons = page.getByTitle("Delete Event");
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
    }

    // Add Assembly
    await page.getByRole("button", { name: "Assembly" }).click();
    const eventCard1 = page.locator("div.rounded-2xl.border.bg-white.p-5").first();
    const timeInputs1 = eventCard1.locator("input[type='time']");
    await timeInputs1.nth(0).fill("09:00");
    await timeInputs1.nth(1).fill("09:20");

    // Add Lunch
    await page.getByRole("button", { name: "Lunch Break" }).click();
    const eventCard2 = page.locator("div.rounded-2xl.border.bg-white.p-5").nth(1);
    const timeInputs2 = eventCard2.locator("input[type='time']");
    await timeInputs2.nth(0).fill("12:10");
    await timeInputs2.nth(1).fill("12:40");

    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();
    await expect(page.getByText("Assembly").first()).toBeVisible();
    await expect(page.getByText("Lunch Break").first()).toBeVisible();
  });

  test("Scenario C: Arbitrary micro-timings (08:37-09:11, 10:07-10:19, 12:03-12:47, 14:18-14:26)", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel(/Start Time/i).fill("08:30");
    await page.getByLabel(/End Time/i).fill("15:30");

    // Delete default events first for a clean configuration
    const deleteButtons = page.getByTitle("Delete Event");
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
    }

    // Add custom event
    await page.getByRole("button", { name: "Add Event" }).click();
    const customTitle = page.getByPlaceholder("e.g. Morning Assembly").first();
    await customTitle.fill("Micro Event");

    const eventCard = page.locator("div.rounded-2xl.border.bg-white.p-5").first();
    const eventTimeInputs = eventCard.locator("input[type='time']");
    await eventTimeInputs.nth(0).fill("08:37");
    await eventTimeInputs.nth(1).fill("09:11");

    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    await page.goto("/timetable");
    await expect(page.getByText("Micro Event").first()).toBeVisible();
  });
});
