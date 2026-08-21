import { Page, Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly showPasswordToggle: Locator;
  readonly signInButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;
  readonly brandHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator("#login-email");
    this.passwordInput = page.locator("#login-password");
    this.showPasswordToggle = page.getByRole("button", { name: /(Show|Hide) password/i });
    this.signInButton = page.getByRole("button", { name: /Sign In/i });
    this.registerLink = page.getByRole("link", { name: /Create one/i });
    this.errorMessage = page.locator(".text-rose-700");
    this.brandHeading = page.getByRole("heading", { name: "Ragavi Scheduler AI" });
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.brandHeading).toBeVisible();
  }

  async login(email: string, pass: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(pass);
    await expect(this.signInButton).toBeEnabled();
    await this.signInButton.click();
  }
}
