import { Page, Locator, expect } from "@playwright/test";

export class SubjectsPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly periodsInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator("#subject-name");
    this.periodsInput = page.locator("#subject-periods");
    this.saveButton = page.getByRole("button", { name: /Add Subject|Update Subject/i });
  }

  async goto() {
    await this.page.goto("/subjects");
    await expect(this.page.getByRole("heading", { name: /Subjects Management/i })).toBeVisible();
  }

  async addSubject(name: string, periods: string) {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
    await this.periodsInput.clear();
    await this.periodsInput.fill(periods);
    await this.saveButton.click();
    await expect(this.page.getByText(name)).toBeVisible();
  }
}
