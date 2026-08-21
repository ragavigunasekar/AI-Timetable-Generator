import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Application Route Navigation QA Suite", () => {
  test.beforeEach(async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("nav");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  const routes = [
    { path: "/dashboard", heading: /timetable workspace|Welcome/i },
    { path: "/teachers", heading: /Teachers Management|Teachers/i },
    { path: "/subjects", heading: /Subjects Management|Subjects/i },
    { path: "/classes", heading: /Classes Management|Classes/i },
    { path: "/settings", heading: /School Configuration|School Settings/i },
    { path: "/allocations", heading: /Subject Allocations|Allocations/i },
    { path: "/timetable", heading: /Timetable Generator|School Timetable/i },
    { path: "/reports", heading: /Reports|Analytics/i },
    { path: "/profile", heading: /Profile|Account Settings/i },
  ];

  for (const route of routes) {
    test(`Navigates to ${route.path} without errors or blank screens`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(route.path));
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    });
  }

  test("Browser Back / Forward navigation works smoothly", async ({ page }) => {
    await page.goto("/teachers");
    await expect(page).toHaveURL(/\/teachers/);

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);

    await page.goBack();
    await expect(page).toHaveURL(/\/teachers/);

    await page.goForward();
    await expect(page).toHaveURL(/\/settings/);
  });
});
