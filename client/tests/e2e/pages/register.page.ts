import { Page, Locator, expect } from "@playwright/test";

export class RegisterPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly showPasswordToggle: Locator;
  readonly showConfirmPasswordToggle: Locator;
  readonly createAccountButton: Locator;
  readonly signInLink: Locator;
  readonly errorMessage: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator("#register-email");
    this.passwordInput = page.locator("#register-password");
    this.confirmPasswordInput = page.locator("#register-confirm-password");
    this.showPasswordToggle = page.getByRole("button", { name: /(Show|Hide) password/i }).nth(0);
    this.showConfirmPasswordToggle = page.getByRole("button", { name: /(Show|Hide) password/i }).nth(1);
    this.createAccountButton = page.getByRole("button", { name: /Create Account/i });
    this.signInLink = page.getByRole("link", { name: /Sign in/i });
    this.errorMessage = page.locator(".text-rose-700");
    this.heading = page.getByRole("heading", { name: "Create Account" });
  }

  async goto() {
    await this.page.goto("/register");
    await expect(this.heading).toBeVisible();
  }

  async register(email: string, pass: string, confirmPass: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(pass);
    await this.confirmPasswordInput.fill(confirmPass);
    await expect(this.createAccountButton).toBeEnabled();
    await this.createAccountButton.click();
  }
}
