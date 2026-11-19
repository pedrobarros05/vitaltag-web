import { expect, test } from "./fixtures";
import { DEMO } from "./support";

// QR Codes printed before the rename point at /publico/<slug>; they must keep working.
test.describe("/publico → /public redirect", () => {
  test("the old URL opens the public page", async ({ page }) => {
    await page.goto(`/publico/${DEMO.slug}`);

    await expect(page).toHaveURL(new RegExp(`/public/${DEMO.slug}$`));
    await expect(page.getByRole("heading", { name: "Emergency Data" })).toBeVisible();

    await page.getByLabel("Emergency password").fill(DEMO.publicPassword);
    await page.getByRole("button", { name: "Access data" }).click();
    await expect(page.getByRole("heading", { name: "Demo User" })).toBeVisible();
  });

  test("is a temporary (307) redirect that keeps the slug", async ({ request }) => {
    const res = await request.get("/publico/AbC-123_x", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toBe("/public/AbC-123_x");
  });
});
