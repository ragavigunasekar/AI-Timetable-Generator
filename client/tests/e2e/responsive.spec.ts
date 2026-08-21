import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

const viewports = [
  { name: "Desktop", width: 1440, height: 900 },
  { name: "Laptop", width: 1280, height: 720 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Mobile", width: 390, height: 844 },
];

test.describe("Responsive Design QA Suite", () => {
  for (const vp of viewports) {
    test(`Renders application correctly on ${vp.name} viewport (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const registerPage = new RegisterPage(page);
      await registerPage.goto();
      const user = generateTestUser(`resp${vp.width}`);
      await registerPage.register(user.email, user.password, user.password);
      await expect(page).toHaveURL(/\/dashboard/);

      // Verify dashboard heading is visible
      await expect(page.getByRole("heading", { name: /timetable workspace|Welcome/i }).first()).toBeVisible();

      // Navigate to Settings
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: /School Configuration|School Settings/i })).toBeVisible();
    });
  }
});
