import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO, createUserWithProfile } from "./support";

async function submitPassword(page: Page, password: string) {
  await page.getByLabel("Emergency password").fill(password);
  await page.getByRole("button", { name: "Access data" }).click();
}

test.describe("Public page (password protected)", () => {
  test("shows nothing until the right password is entered", async ({ page, request }) => {
    // Own profile: wrong passwords count towards the lockout, so keep them off the demo page
    const owner = await createUserWithProfile(request);
    await page.goto(`/public/${owner.slug}`);

    await expect(page.getByRole("heading", { name: "Emergency Data" })).toBeVisible();
    await expect(page.getByText("Dipyrone")).toHaveCount(0);

    await submitPassword(page, "0000");
    await expect(page.getByText("Incorrect password. Please try again.")).toBeVisible();
    await expect(page.getByText("Dipyrone")).toHaveCount(0);

    await submitPassword(page, owner.publicPassword);
    await expect(page.getByText("🚨 MEDICAL EMERGENCY DATA")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Maria Silva" })).toBeVisible();
    await expect(page.getByText("Dipyrone")).toBeVisible();
  });

  test("shows the clinical data in English, with callable contacts", async ({ page }) => {
    await page.goto(`/public/${DEMO.slug}`);
    await submitPassword(page, DEMO.publicPassword);

    await expect(page.getByRole("heading", { name: "Demo User" })).toBeVisible();
    await expect(page.getByText("12/04/1988")).toBeVisible(); // 1988-04-12, day first
    await expect(page.getByText("O-", { exact: true })).toBeVisible();

    // Severities come from the API as grave/moderada and must be shown translated
    const allergies = page.locator("div.card", { has: page.getByRole("heading", { name: "⚠️ Allergies" }) });
    await expect(allergies.locator("div", { hasText: "Penicillin" }).getByText("severe")).toBeVisible();
    await expect(allergies.locator("div", { hasText: "Shellfish" }).getByText("moderate")).toBeVisible();
    await expect(allergies.getByText(/grave|moderada/)).toHaveCount(0);

    await expect(page.getByText("50 mg — Once a day")).toBeVisible();
    await expect(page.getByText(/Hypertension\s+since 01\/06\/2015/)).toBeVisible();
    await expect(page.getByRole("link", { name: /\(00\) 00000-0001/ })).toHaveAttribute(
      "href",
      "tel:00000000001"
    );
  });

  test("unknown slug → 'Profile not found.'", async ({ page }) => {
    await page.goto("/public/does-not-exist");
    await submitPassword(page, "1234");
    await expect(page.getByText("Profile not found.")).toBeVisible();
  });

  test("locks out after 5 wrong passwords, even for the right one", async ({ page, request }) => {
    // Own profile: locking the demo page would break the other specs for 15 minutes
    const owner = await createUserWithProfile(request);
    await page.goto(`/public/${owner.slug}`);

    for (let i = 1; i <= 4; i++) {
      await submitPassword(page, "0000");
      await expect(page.getByText("Incorrect password. Please try again.")).toBeVisible();
      await page.getByLabel("Emergency password").fill(""); // clears the message before the next try
    }
    await submitPassword(page, "0000");
    const locked = page.getByText("⛔ Too many incorrect attempts. Try again in 15 minutes.");
    await expect(locked).toBeVisible();

    await submitPassword(page, owner.publicPassword);
    await expect(locked).toBeVisible();
    await expect(page.getByText("Dipyrone")).toHaveCount(0);
  });
});
