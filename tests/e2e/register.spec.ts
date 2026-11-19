import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO, uniqueEmail } from "./support";

async function fillRegistration(page: Page, email: string) {
  await page.goto("/auth/register");
  await page.getByLabel("First name", { exact: true }).fill("Maria");
  await page.getByLabel("Last name", { exact: true }).fill("Silva");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password1");
}

test.describe("Registration", () => {
  test("creates an account, then signs in to an empty dashboard", async ({ page }) => {
    const email = uniqueEmail("register");
    await fillRegistration(page, email);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/auth\/login\?registered=1$/);
    await expect(page.getByText("Account created successfully! Please sign in.")).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password1");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Welcome to VitalTag! 👋" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up profile" })).toBeVisible();
  });

  test("LGPD consent is required", async ({ page }) => {
    await fillRegistration(page, uniqueEmail("register"));
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("You must consent to the use of your data.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/register$/);
  });

  test("an email that is already registered is rejected", async ({ page }) => {
    await fillRegistration(page, DEMO.email);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("email already registered")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/register$/);
  });
});
