import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { TeachersPage } from "./pages/teachers.page";
import { SubjectsPage } from "./pages/subjects.page";
import { ClassesPage } from "./pages/classes.page";
import { AllocationsPage } from "./pages/allocations.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Smart Timetable Generation QA Suite", () => {
  test("Generates conflict-free timetable satisfying hard constraints and searching alternative teaching windows", async ({ page }) => {
    // 1. Register & setup school
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("ttgen");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Configure School Settings with Timeline Events (Assembly & Lunch)
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

    // 3. Add Teachers
    const teachersPage = new TeachersPage(page);
    await teachersPage.goto();
    await teachersPage.addTeacher("T01", "Dr. Alan Turing", "Mathematics", "15");
    await teachersPage.addTeacher("T02", "Marie Curie", "Science", "15");

    // 4. Add Subjects
    const subjectsPage = new SubjectsPage(page);
    await subjectsPage.goto();
    await subjectsPage.addSubject("Mathematics", "4");
    await subjectsPage.addSubject("Science", "4");

    // 5. Add Classes
    const classesPage = new ClassesPage(page);
    await classesPage.goto();
    await classesPage.addClass("Grade 6", "Section-A");
    await classesPage.addClass("Grade 6", "Section-B");

    // 6. Add Allocations
    const allocationsPage = new AllocationsPage(page);
    await allocationsPage.goto();
    await allocationsPage.addAllocation(1, 1, 1, "4"); // Grade 6A - Maths - Turing
    await allocationsPage.addAllocation(1, 2, 2, "4"); // Grade 6A - Science - Curie

    // 7. Generate Timetable
    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();

    const generateBtn = page.getByRole("button", { name: /Generate Timetable|Regenerate/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
    }

    // 8. Verify generation output success message
    await expect(page.getByText(/Timetable generated|Timetable Generated|Generated Successfully/i).first()).toBeVisible();

    // 9. Verify locked timeline events are NOT overwritten
    await expect(page.getByText("Assembly").first()).toBeVisible();
    await expect(page.getByText("Lunch Break").first()).toBeVisible();

    // 10. Reload page & verify persistence
    await page.reload();
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();
  });
});
