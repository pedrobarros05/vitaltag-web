import { expect, test } from "./fixtures";
import QRCode from "qrcode";
import { WEB_URL } from "./env";
import { DEMO, createUser, signIn } from "./support";

test.describe("QR Code", () => {
  test("generates a QR Code that encodes the public page URL, and downloads it", async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password);

    await page.getByRole("button", { name: "Generate QR Code" }).click();

    const img = page.getByRole("img", { name: "Emergency QR Code" });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBeGreaterThan(0);

    // The displayed PNG must be exactly the QR Code for <WEB_URL>/public/demo
    const shown = Buffer.from(
      await img.evaluate(async (el: HTMLImageElement) => {
        const bytes = new Uint8Array(await (await fetch(el.src)).arrayBuffer());
        return Array.from(bytes);
      })
    );
    const expected = await QRCode.toBuffer(`${WEB_URL}/public/${DEMO.slug}`, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    expect(shown.equals(expected), "QR Code must encode the public page URL").toBe(true);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download PNG" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("vitaltag-qrcode.png");
  });

  test("the URL in the QR Code opens the password-protected public page", async ({ page }) => {
    await page.goto(`${WEB_URL}/public/${DEMO.slug}`);
    await expect(page.getByRole("heading", { name: "Emergency Data" })).toBeVisible();
  });

  test("a user without a profile gets no QR Code button", async ({ page, request }) => {
    const user = await createUser(request);
    await signIn(page, user.email, user.password);

    await expect(page.getByRole("heading", { name: "Welcome to VitalTag! 👋" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate QR Code" })).toHaveCount(0);
  });
});
