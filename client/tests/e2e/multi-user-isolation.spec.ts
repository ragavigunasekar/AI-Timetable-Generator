import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { LoginPage } from "./pages/login.page";
import { TeachersPage } from "./pages/teachers.page";
import { SubjectsPage } from "./pages/subjects.page";
import { ClassesPage } from "./pages/classes.page";
import { AllocationsPage } from "./pages/allocations.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("CRITICAL: Multi-User Data Isolation QA Suite", () => {
  test("Strict multi-tenant data isolation across UI and API layers", async ({ page, request }) => {
    const userA = generateTestUser("userA");
    const userB = generateTestUser("userB");

    // ─── Step 1: User A Creates Resources ─────────────────────────────────────
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.register(userA.email, userA.password, userA.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const teachersPage = new TeachersPage(page);
    await teachersPage.goto();
    await teachersPage.addTeacher("UA-T01", "Professor User A", "Alpha Science", "10");
    await expect(page.getByText("Professor User A")).toBeVisible();

    const subjectsPage = new SubjectsPage(page);
    await subjectsPage.goto();
    await subjectsPage.addSubject("Alpha Subject A", "4");
    await expect(page.getByText("Alpha Subject A")).toBeVisible();

    const classesPage = new ClassesPage(page);
    await classesPage.goto();
    await classesPage.addClass("Alpha Class 1", "Section-A");
    await expect(page.getByText("Alpha Class 1")).toBeVisible();

    const allocationsPage = new AllocationsPage(page);
    await allocationsPage.goto();
    await allocationsPage.addAllocation(1, 1, 1, "4");
    await expect(page.getByText(/Alpha Class 1-Section-A/i)).toBeVisible();

    // Configure timeline events & settings as User A
    await page.goto("/settings");
    await page.getByLabel(/School Name/i).clear();
    await page.getByLabel(/School Name/i).fill("User A Academy");

    // Delete default events first
    const deleteButtons = page.getByTitle("Delete Event");
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
    }

    await page.getByRole("button", { name: "Assembly" }).click();
    await page.getByRole("button", { name: /Save Configuration|Save Settings|Save Changes/i }).click();
    await expect(page.getByText(/configuration updated successfully|Settings updated successfully/i).first()).toBeVisible();

    // Generate Timetable as User A
    await page.goto("/timetable");
    await expect(page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();
    const genBtn = page.getByRole("button", { name: /Generate Timetable|Regenerate/i });
    if (await genBtn.isVisible()) {
      await genBtn.click();
    }

    // Logout User A
    await page.getByRole("button", { name: /Sign Out|Logout/i }).click();
    await expect(page).toHaveURL(/\/$/);

    // ─── Step 2: User B Registers & Verifies User A Data Is NOT Visible (UI) ──
    await registerPage.goto();
    await registerPage.register(userB.email, userB.password, userB.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Check Teachers - User A's teacher must NOT exist for User B
    await teachersPage.goto();
    await expect(page.getByText("Professor User A")).not.toBeVisible();
    await expect(page.getByText("UA-T01")).not.toBeVisible();

    // Check Subjects - User A's subject must NOT exist for User B
    await subjectsPage.goto();
    await expect(page.getByText("Alpha Subject A")).not.toBeVisible();

    // Check Classes - User A's class must NOT exist for User B
    await classesPage.goto();
    await expect(page.getByText("Alpha Class 1")).not.toBeVisible();

    // Check Allocations - User A's allocation must NOT exist for User B
    await allocationsPage.goto();
    await expect(page.getByText("Alpha Class 1")).toHaveCount(0);

    // Check Settings - User A's school name must NOT exist for User B
    await page.goto("/settings");
    await expect(page.getByLabel(/School Name/i)).not.toHaveValue("User A Academy");

    // Check Timetable - User A's timetable data must NOT exist for User B
    await page.goto("/timetable");
    await expect(page.getByText("Alpha Subject A")).not.toBeVisible();
    await expect(page.getByText("Professor User A")).not.toBeVisible();

    // User B creates own resources
    await teachersPage.goto();
    await teachersPage.addTeacher("UB-T01", "Doctor User B", "Beta Physics", "12");
    await expect(page.getByText("Doctor User B")).toBeVisible();

    // ─── Step 3: API Layer Multi-Tenant Security Check ─────────────────────
    const token = await page.evaluate(() => localStorage.getItem("ragavi_token"));
    if (token) {
      // Attempt to access/modify record 1 (User A's teacher/resource) using User B's token
      const deleteAttempt = await request.delete("http://localhost:4000/api/teachers/1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([404, 403, 400]).toContain(deleteAttempt.status());

      const updateAttempt = await request.put("http://localhost:4000/api/teachers/1", {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: "Hacked Teacher Name" },
      });
      expect([404, 403, 400]).toContain(updateAttempt.status());
    }

    // Logout User B
    await page.getByRole("button", { name: /Sign Out|Logout/i }).click();

    // ─── Step 4: User A Logs Back In & Verifies Data 100% Intact ─────────────
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(userA.email, userA.password);
    await expect(page).toHaveURL(/\/dashboard/);

    await teachersPage.goto();
    await expect(page.getByText("Professor User A")).toBeVisible();
    await expect(page.getByText("Doctor User B")).not.toBeVisible(); // Must NOT see User B's teacher

    await subjectsPage.goto();
    await expect(page.getByText("Alpha Subject A")).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByLabel(/School Name/i)).toHaveValue("User A Academy");
  });
});
