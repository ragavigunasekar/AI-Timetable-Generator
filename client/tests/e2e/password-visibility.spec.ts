import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/login.page";
import { RegisterPage } from "./pages/register.page";

test.describe("Password Visibility Eye Icon Tests", () => {
  test("Login form: toggles password field type between password and text", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Initial state: type="password"
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    // Click Eye button to show password
    await loginPage.showPasswordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "text");

    // Click EyeOff button to hide password
    await loginPage.showPasswordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("Register form: toggles password and confirm password fields independently", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Initial state
    await expect(registerPage.passwordInput).toHaveAttribute("type", "password");
    await expect(registerPage.confirmPasswordInput).toHaveAttribute("type", "password");

    // Toggle main password field
    await registerPage.showPasswordToggle.click();
    await expect(registerPage.passwordInput).toHaveAttribute("type", "text");
    await expect(registerPage.confirmPasswordInput).toHaveAttribute("type", "password");

    // Toggle confirm password field
    await registerPage.showConfirmPasswordToggle.click();
    await expect(registerPage.passwordInput).toHaveAttribute("type", "text");
    await expect(registerPage.confirmPasswordInput).toHaveAttribute("type", "text");

    // Toggle main password back to hidden
    await registerPage.showPasswordToggle.click();
    await expect(registerPage.passwordInput).toHaveAttribute("type", "password");
    await expect(registerPage.confirmPasswordInput).toHaveAttribute("type", "text");
  });
});
