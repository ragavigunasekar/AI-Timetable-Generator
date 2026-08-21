import { Page, Locator, expect } from "@playwright/test";

export class ClassesPage {
  readonly page: Page;
  readonly classNameInput: Locator;
  readonly sectionInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.classNameInput = page.locator("#class-name");
    this.sectionInput = page.locator("#class-section");
    this.saveButton = page.getByRole("button", { name: /Add Class|Update Class/i });
  }

  async goto() {
    await this.page.goto("/classes");
    await expect(this.page.getByRole("heading", { name: /Classes Management/i })).toBeVisible();
  }

  async addClass(className: string, section: string) {
    await this.classNameInput.clear();
    await this.classNameInput.fill(className);
    await this.sectionInput.clear();
    await this.sectionInput.fill(section);
    await this.saveButton.click();
    await expect(this.page.getByText(className).first()).toBeVisible();
  }
}
