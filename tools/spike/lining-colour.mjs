// §35 The lining against the boards, in the 3D view: before this it was the
// face colour a shade darker, which is not a difference you can see.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
for (const face of ["front", "back", "left", "right", "top", "bottom"]) {
  await page.locator(".controls").getByLabel("Add lagging", { exact: true }).selectOption(face);
}
await page.waitForTimeout(600);

// Exploded, so the lining panels sit clear of the boards they line.
await page.locator(".pane-view").getByRole("button", { name: "Shaded", exact: true }).click();
await page.locator("#explode").fill("70");
await page.waitForTimeout(1400);
await page.screenshot({ path: `${out}/lining-colour.png` });

// And the sidebar swatches, which read the same palette.
await page.locator(".controls .group").filter({ hasText: "Lagging" }).first().screenshot({ path: `${out}/lining-swatches.png` }).catch(() => {});
console.log("swatches:", await page.evaluate(() =>
  [...document.querySelectorAll(".stack-list .swatch")].map((el) => getComputedStyle(el).backgroundColor).join(" ")));
await browser.close();
