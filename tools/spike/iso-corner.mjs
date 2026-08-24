import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 4 });
const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
await page.goto("http://localhost:5012/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.locator(".controls").getByLabel("Treatment").getByRole("button", { name: "Fillet" }).click();
await page.locator(".controls").getByLabel("Radius").fill("14");
await page.waitForTimeout(700);
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1200);
const r = await page.evaluate(() => {
  const g = document.querySelector('.sheet-holder g[data-view="iso"]');
  const b = g.getBoundingClientRect();
  return { x: b.x, y: b.y, width: b.width, height: b.height };
});
// The top corner of the box, where three rounds meet.
await page.screenshot({ path: `${out}/corner.png`,
  clip: { x: r.x + r.width * 0.05, y: r.y, width: r.width * 0.6, height: r.height * 0.35 } });
await browser.close();
