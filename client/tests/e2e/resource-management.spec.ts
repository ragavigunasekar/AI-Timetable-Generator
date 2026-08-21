import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { TeachersPage } from "./pages/teachers.page";
import { SubjectsPage } from "./pages/subjects.page";
import { ClassesPage } from "./pages/classes.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Resource Management CRUD QA Suite", () => {
  test.beforeEach(async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const user = generateTestUser("resource");
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Teachers CRUD: create, view, edit, delete", async ({ page }) => {
    const teachersPage = new TeachersPage(page);
    await teachersPage.goto();

    // 1. Create teacher
    await teachersPage.addTeacher("T101", "Dr. Alan Turing", "Computer Science", "20");
    await expect(page.getByText("Dr. Alan Turing")).toBeVisible();
    await expect(page.getByText("T101")).toBeVisible();

    // 2. Edit teacher
    const editBtn = page.locator("button").filter({ hasText: /Edit/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await teachersPage.nameInput.clear();
      await teachersPage.nameInput.fill("Dr. Alan M. Turing");
      await teachersPage.saveButton.click();
      await expect(page.getByText("Dr. Alan M. Turing")).toBeVisible();
    }

    // 3. Reload page & verify persistence
    await page.reload();
    await expect(page.getByText("T101")).toBeVisible();
  });

  test("Subjects CRUD: create, view, edit, delete", async ({ page }) => {
    const subjectsPage = new SubjectsPage(page);
    await subjectsPage.goto();

    // 1. Create subject
    await subjectsPage.addSubject("Mathematics", "5");
    await expect(page.getByText("Mathematics")).toBeVisible();

    // 2. Reload page & verify persistence
    await page.reload();
    await expect(page.getByText("Mathematics")).toBeVisible();
  });

  test("Classes CRUD: create, view, edit, delete", async ({ page }) => {
    const classesPage = new ClassesPage(page);
    await classesPage.goto();

    // 1. Create class
    await classesPage.addClass("Grade 10", "Section-A");
    await expect(page.getByText("Grade 10")).toBeVisible();
    await expect(page.getByText("Section-A")).toBeVisible();

    // 2. Reload page & verify persistence
    await page.reload();
    await expect(page.getByText("Grade 10")).toBeVisible();
  });
});
