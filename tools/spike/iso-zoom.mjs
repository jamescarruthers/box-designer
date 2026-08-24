// §38 A close look at the isometric alone, in place and exploded.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await field("Add doublers").selectOption("front");
await field("Add a fitting").selectOption("driver");
await page.waitForTimeout(600);
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1000);

const shoot = async (name) => {
  const box = await page.evaluate(() => {
    const g = document.querySelector('.sheet-holder g[data-view="iso"]');
    const r = g.getBoundingClientRect();
    return { x: r.x - 10, y: r.y - 10, width: r.width + 20, height: r.height + 20 };
  });
  await page.screenshot({ path: `${out}/${name}.png`, clip: box });
};
await shoot("zoom-place");
for (const v of ["40", "80"]) {
  await field("Explode isometric").fill(v);
  await page.waitForTimeout(700);
  await shoot(`zoom-${v}`);
}
await browser.close();
