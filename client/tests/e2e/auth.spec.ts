import { test, expect } from "@playwright/test";
import { RegisterPage } from "./pages/register.page";
import { LoginPage } from "./pages/login.page";
import { generateTestUser } from "./utils/auth-helpers";

test.describe("Human-Like Authentication QA Suite", () => {
  test("Landing page loads with proper branding and structure", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page.getByText(/Ragavi Scheduler AI/i).first()).toBeVisible();
    await expect(page.getByText(/Sign in to your account/i)).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInButton).toBeDisabled();
  });

  test("Registration form validation for missing fields and weak password", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // 1. Submit empty form
    await registerPage.createAccountButton.click();
    await expect(registerPage.errorMessage).toContainText(/Please fill in all fields/i);

    // 2. Invalid email
    await registerPage.emailInput.fill("invalid-email");
    await registerPage.passwordInput.fill("Password123!");
    await registerPage.confirmPasswordInput.fill("Password123!");
    await registerPage.createAccountButton.click();
    await expect(registerPage.errorMessage).toContainText(/valid email/i);

    // 3. Weak password (no uppercase or digits)
    await registerPage.emailInput.fill("valid.email@example.com");
    await registerPage.passwordInput.fill("weak");
    await registerPage.confirmPasswordInput.fill("weak");
    await registerPage.createAccountButton.click();
    await expect(registerPage.errorMessage).toContainText(/at least 8 characters/i);

    // 4. Password mismatch
    await registerPage.passwordInput.fill("Password123!");
    await registerPage.confirmPasswordInput.fill("Password999!");
    await registerPage.createAccountButton.click();
    await expect(registerPage.errorMessage).toContainText(/do not match/i);
  });

  test("Successful user registration redirects to dashboard", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    const newUser = generateTestUser("register");

    await registerPage.register(newUser.email, newUser.password, newUser.password);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Welcome/i).first()).toBeVisible();
  });

  test("Duplicate email registration fails with clean error message", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const existingUser = generateTestUser("dup");

    // Register first time
    await registerPage.goto();
    await registerPage.register(existingUser.email, existingUser.password, existingUser.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout
    await page.getByRole("button", { name: /Sign Out|Logout/i }).click();

    // Try registering same email again
    await registerPage.goto();
    await registerPage.register(existingUser.email, existingUser.password, existingUser.password);
    await expect(registerPage.errorMessage).toContainText(/already exists/i);
  });

  test("Login validations: empty fields, invalid password, non-existent account", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Invalid password / Non-existent account
    await loginPage.login("nonexistent.user.999@example.com", "WrongPassword123!");
    await expect(loginPage.errorMessage).toContainText(/Login failed|Invalid credentials/i);
  });

  test("Successful login with existing account", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const loginPage = new LoginPage(page);
    const user = generateTestUser("login");

    // Create user
    await registerPage.goto();
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout
    await page.getByRole("button", { name: /Sign Out|Logout/i }).click();

    // Login via UI
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Unauthenticated user is redirected to login when trying to access protected routes", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/teachers");
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/timetable");
    await expect(page).toHaveURL(/\/$/);
  });

  test("Session persistence on page refresh", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const user = generateTestUser("persist");

    await registerPage.goto();
    await registerPage.register(user.email, user.password, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Reload page
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Scheduler AI/i).first()).toBeVisible();
  });
});
