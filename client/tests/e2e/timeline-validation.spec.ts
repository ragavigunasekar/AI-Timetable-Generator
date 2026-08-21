import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Timeline Validation QA Suite", () => {
  test.beforeEach(async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("valid");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/settings");
  });

  test("Rejects invalid event timing (End time before start time)", async ({ page }) => {
    await page.getByRole("button", { name: "Add Event" }).click();

    const titleInput = page.getByPlaceholder("e.g. Morning Assembly").first();
    await titleInput.fill("Invalid Timing Event");

    // Scope to the timeline event card (skipping school start/end time inputs)
    const eventCard = page.locator("div.rounded-2xl.border.bg-white.p-5").first();
    const eventTimeInputs = eventCard.locator("input[type='time']");

    // Set Start Time to 12:00 and End Time to 11:00 (invalid)
    await eventTimeInputs.nth(0).fill("12:00");
    await eventTimeInputs.nth(1).fill("11:00");

    // Expect validation message "End time must be after start time"
    await expect(page.getByText(/End time must be after start/i).first()).toBeVisible();
  });
});
