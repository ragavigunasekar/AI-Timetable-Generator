import { Page, Locator, expect } from "@playwright/test";

export class TeachersPage {
  readonly page: Page;
  readonly codeInput: Locator;
  readonly nameInput: Locator;
  readonly subjectInput: Locator;
  readonly workloadInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.codeInput = page.locator("#teacher-code");
    this.nameInput = page.locator("#teacher-name");
    this.subjectInput = page.locator("#teacher-subject");
    this.workloadInput = page.locator("#teacher-workload");
    this.saveButton = page.getByRole("button", { name: /Add Teacher|Update Teacher/i });
  }

  async goto() {
    await this.page.goto("/teachers");
    await expect(this.page.getByRole("heading", { name: /Teachers Management/i })).toBeVisible();
  }

  async addTeacher(code: string, name: string, subject: string, workload: string) {
    await this.codeInput.clear();
    await this.codeInput.fill(code);
    await this.nameInput.clear();
    await this.nameInput.fill(name);
    await this.subjectInput.clear();
    await this.subjectInput.fill(subject);
    await this.workloadInput.clear();
    await this.workloadInput.fill(workload);
    await this.saveButton.click();
    await expect(this.page.getByText(name)).toBeVisible();
  }
}
