import { Page, APIRequestContext, expect } from "@playwright/test";

export function generateTestUser(prefix = "user") {
  const timestamp = Date.now() + Math.floor(Math.random() * 10000);
  return {
    email: `qa.${prefix}.${timestamp}@example.com`,
    password: "Password123!",
  };
}

export async function registerUserViaApi(request: APIRequestContext, user: { email: string; password: string }) {
  const response = await request.post("http://localhost:4000/api/auth/register", {
    data: {
      email: user.email,
      password: user.password,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.data.token as string;
}

export async function loginUserViaApi(request: APIRequestContext, user: { email: string; password: string }) {
  const response = await request.post("http://localhost:4000/api/auth/login", {
    data: {
      email: user.email,
      password: user.password,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.data.token as string;
}

export async function loginViaUi(page: Page, user: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel(/Email Address/i).fill(user.email);
  await page.getByLabel(/^Password/i).fill(user.password);
  await page.getByRole("button", { name: /Sign In/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function setAuthTokenInBrowser(page: Page, token: string) {
  await page.goto("/");
  await page.evaluate((t) => {
    localStorage.setItem("ragavi_token", t);
  }, token);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
}
