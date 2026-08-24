// §40/§41 A filleted box in the isometric, and the lagging dimension when the
// insulation is switched off.
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

await field("Add a fitting").selectOption("driver");
await page.locator(".controls").getByLabel("Treatment").getByRole("button", { name: "Fillet" }).click();
await page.locator(".controls").getByLabel("Radius").fill("14");
await page.waitForTimeout(700);
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1200);

const shoot = async (name) => {
  const box = await page.evaluate(() => {
    const g = document.querySelector('.sheet-holder g[data-view="iso"]');
    const r = g.getBoundingClientRect();
    return { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 24 };
  });
  await page.screenshot({ path: `${out}/${name}.png`, clip: box });
};
await shoot("fillet-iso");
await field("Explode isometric").fill("50");
await page.waitForTimeout(700);
await shoot("fillet-iso-apart");
await field("Explode isometric").fill("0");

// §41 The lining, and what its dimension does when it is switched off.
const texts = () => page.evaluate(() =>
  [...document.querySelectorAll('.sheet-holder g[data-dims] text')].map((t) => t.textContent).join(" "));
for (const face of ["front", "back", "left", "right", "top", "bottom"])
  await field("Add lagging").selectOption(face);
await page.waitForTimeout(900);
console.log("lining shown: ", await texts());
await field("Acoustic insulation").click();
await page.waitForTimeout(900);
console.log("lining hidden:", await texts());
await page.locator(".sheet-holder").screenshot({ path: `${out}/fillet-sheet.png` });
await browser.close();
