import { expect, test } from "./fixtures";
import { DEMO, signIn } from "./support";

test.describe("Login", () => {
  test("demo user signs in and lands on the dashboard", async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password);

    await expect(page.getByRole("heading", { name: "Hi, Demo! 👋" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("vitaltag_token"))).toMatch(/^mock\./);
  });

  test("email is case-insensitive", async ({ page }) => {
    await signIn(page, "Demo@Example.COM", DEMO.password);
    await expect(page.getByRole("heading", { name: "Hi, Demo! 👋" })).toBeVisible();
  });

  test("wrong password shows the API's error and stays on the login page", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(DEMO.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("incorrect email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test("the dashboard sends signed-out visitors to the login page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test("the site root redirects to the login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
