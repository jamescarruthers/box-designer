// §32 The section, close up: does the stipple read as a lining beside a board?
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 4 });
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
// A doubled, clad, lined wall, so all four hatches appear side by side.
for (const [label, face] of [["Add cladding", "back"], ["Add doublers", "back"], ["Add lagging", "back"]]) {
  await page.locator(".controls").getByLabel(label, { exact: true }).selectOption(face);
}
await page.waitForTimeout(400);
const th = page.locator(".controls").getByLabel("Lagging Back thickness", { exact: true });
await th.fill("20"); await th.blur();
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1500);
await page.locator('[data-view="section"]').screenshot({ path: `${out}/section-zoom.png` });
console.log("hatch areas:", await page.locator('[data-view="section"] rect[fill^="url"]').count());
await browser.close();
