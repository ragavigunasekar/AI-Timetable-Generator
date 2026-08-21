import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Timeline Event Cursor Focus Regression Test", () => {
  test("Typing into event title maintains cursor focus across continuous character inputs", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("focus");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Daily Timeline Events" })).toBeVisible();

    // Add a custom timeline event
    await page.getByRole("button", { name: "Add Event" }).click();

    const titleInput = page.getByPlaceholder("e.g. Morning Assembly").first();
    await titleInput.click();
    await titleInput.clear();

    // Type "Morning Assembly and School Prayer" continuously WITHOUT clicking again between characters
    await titleInput.pressSequentially("Morning Assembly and School Prayer", { delay: 30 });

    // Verify the value is exactly "Morning Assembly and School Prayer"
    await expect(titleInput).toHaveValue("Morning Assembly and School Prayer");

    // Verify that the element is still focused
    const isFocused = await titleInput.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);

    // Edit into "Super Morning Assembly and School Prayer" without losing focus
    await titleInput.press("Home");
    await titleInput.pressSequentially("Super ", { delay: 30 });
    await expect(titleInput).toHaveValue("Super Morning Assembly and School Prayer");
  });
});
