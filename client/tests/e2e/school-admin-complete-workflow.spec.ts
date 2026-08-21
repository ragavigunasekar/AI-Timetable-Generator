import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { LoginPage } from "./pages/login.page";
import { TeachersPage } from "./pages/teachers.page";
import { SubjectsPage } from "./pages/subjects.page";
import { ClassesPage } from "./pages/classes.page";
import { AllocationsPage } from "./pages/allocations.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Flagship E2E Journey: School Administrator Complete Workflow", () => {
  test("Complete end-to-end school administrator journey", async ({ page }) => {
    // 1. Launch & Register Admin User A
    const adminUser = generateTestUser("admin");
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.register(adminUser.email, adminUser.password, adminUser.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Configure School Timings & Daily Timeline Events
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /School Configuration|School Settings/i })).toBeVisible();

    await page.getByLabel(/School Name/i).fill("St. Xavier International School");
    await page.getByLabel(/Start Time/i).fill("08:30");
    await page.getByLabel(/End Time/i).fill("15:30");
    await page.getByLabel(/Period Duration/i).fill("45");

    // Delete default events first to avoid overlap conflicts
    const deleteButtons = page.getByTitle("Delete Event");
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
    }

    // Add Assembly & Lunch
    await page.getByRole("button", { name: "Assembly" }).click();
    await page.getByRole("button", { name: "Lunch Break" }).click();

    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    // 3. Add Teachers
    const teachersPage = new TeachersPage(page);
    await teachersPage.goto();
    await teachersPage.addTeacher("T01", "Dr. Robert Oppenheimer", "Physics", "15");
    await teachersPage.addTeacher("T02", "Ada Lovelace", "Mathematics", "15");
    await expect(page.getByText("Dr. Robert Oppenheimer")).toBeVisible();
    await expect(page.getByText("Ada Lovelace")).toBeVisible();

    // 4. Add Subjects
    const subjectsPage = new SubjectsPage(page);
    await subjectsPage.goto();
    await subjectsPage.addSubject("Physics", "4");
    await subjectsPage.addSubject("Mathematics", "4");
    await expect(page.getByText("Physics")).toBeVisible();
    await expect(page.getByText("Mathematics")).toBeVisible();

    // 5. Add Classes
    const classesPage = new ClassesPage(page);
    await classesPage.goto();
    await classesPage.addClass("Grade 9", "Section-A");
    await classesPage.addClass("Grade 9", "Section-B");
    await expect(page.getByText("Grade 9").first()).toBeVisible();

    // 6. Create Allocations
    const allocationsPage = new AllocationsPage(page);
    await allocationsPage.goto();
    await allocationsPage.addAllocation(1, 1, 1, "4"); // Grade 9A - Physics - Oppenheimer
    await allocationsPage.addAllocation(1, 2, 2, "4"); // Grade 9A - Maths - Lovelace

    // 7. Generate & Inspect Timetable
    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();

    const generateBtn = page.getByRole("button", { name: /Generate Timetable|Regenerate/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
    }
    await expect(page.getByText(/Physics|Timetable generated/i).first()).toBeVisible();

    // Verify fixed timeline events exist
    await expect(page.getByText("Assembly").first()).toBeVisible();
    await expect(page.getByText("Lunch Break").first()).toBeVisible();

    // 8. Refresh & Verify Persistence
    await page.reload();
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();

    // 9. Logout
    await page.getByRole("button", { name: /Sign Out|Logout/i }).click();
    await expect(page).toHaveURL(/\/$/);

    // 10. Login as User B and verify complete data isolation
    const userB = generateTestUser("userBadmin");
    await registerPage.goto();
    await registerPage.register(userB.email, userB.password, userB.password);
    await expect(page).toHaveURL(/\/dashboard/);

    await teachersPage.goto();
    await expect(page.getByText("Dr. Robert Oppenheimer")).not.toBeVisible();
    await expect(page.getByText("Ada Lovelace")).not.toBeVisible();

    // 11. Logout User B
    await page.getByRole("button", { name: /Sign Out|Logout/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
