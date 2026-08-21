import { Page, Locator, expect } from "@playwright/test";

export class AllocationsPage {
  readonly page: Page;
  readonly classSelect: Locator;
  readonly subjectSelect: Locator;
  readonly teacherSelect: Locator;
  readonly periodsInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.classSelect = page.locator("select").nth(0);
    this.subjectSelect = page.locator("select").nth(1);
    this.teacherSelect = page.locator("select").nth(2);
    this.periodsInput = page.locator("input[type='number']").first();
    this.saveButton = page.getByRole("button", { name: /Add Allocation|Update Allocation|Save/i });
  }

  async goto() {
    await this.page.goto("/allocations");
    await expect(this.page.getByRole("heading", { name: "Subject Allocations" })).toBeVisible();
  }

  async addAllocation(classIndex: number, subjectIndex: number, teacherIndex: number, periods: string) {
    await this.classSelect.selectOption({ index: classIndex });
    await this.subjectSelect.selectOption({ index: subjectIndex });
    await this.teacherSelect.selectOption({ index: teacherIndex });
    await this.periodsInput.clear();
    await this.periodsInput.fill(periods);
    await this.saveButton.click();
    await expect(this.page.getByText(/Allocation created successfully|Allocation updated successfully/i).first()).toBeVisible();
  }
}
