import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { TeachersPage } from "./pages/teachers.page";
import { SubjectsPage } from "./pages/subjects.page";
import { ClassesPage } from "./pages/classes.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Data Persistence Across Page Reloads QA Suite", () => {
  test("All entities persist accurately after browser reload", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("persistall");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // 1. Add Teacher
    const teachersPage = new TeachersPage(page);
    await teachersPage.goto();
    await teachersPage.addTeacher("PERST01", "Professor Persist", "Physics", "12");

    // 2. Add Subject
    const subjectsPage = new SubjectsPage(page);
    await subjectsPage.goto();
    await subjectsPage.addSubject("Physics Lab", "3");

    // 3. Add Class
    const classesPage = new ClassesPage(page);
    await classesPage.goto();
    await classesPage.addClass("Grade 11", "Sci");

    // 4. Reload page & verify all items exist
    await page.goto("/teachers");
    await expect(page.getByText("Professor Persist")).toBeVisible();

    await page.goto("/subjects");
    await expect(page.getByText("Physics Lab")).toBeVisible();

    await page.goto("/classes");
    await expect(page.getByText("Grade 11")).toBeVisible();
  });
});
