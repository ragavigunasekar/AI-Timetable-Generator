import { Page, Locator, expect } from "@playwright/test";

export class TimetablePage {
  readonly page: Page;
  readonly generateButton: Locator;
  readonly timetableGrid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.generateButton = page.getByRole("button", { name: /Generate Timetable|Regenerate Timetable/i });
    this.timetableGrid = page.locator("table, .grid");
  }

  async goto() {
    await this.page.goto("/timetable");
    await expect(this.page.getByRole("heading", { name: /Timetable Generator|School Timetable/i })).toBeVisible();
  }

  async generate() {
    await this.generateButton.click();
  }
}
