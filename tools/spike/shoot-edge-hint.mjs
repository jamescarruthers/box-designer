// §15 Is the hover highlight actually drawn?
//
// Drawn as a line it was not: WebGL gives every line one pixel whatever
// `linewidth` says, and this one landed on the panel edges already there. This
// crops the same patch with the pointer on an edge and off it, so the two can
// be looked at side by side rather than taken on trust.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Fillet an edge" }).click();
const box = await page.locator(".viewport canvas").boundingBox();
const hot = async () => page.locator(".viewport").evaluate((el) => el.style.cursor === "pointer");

let hit = null;
for (let dy = 0.15; dy < 0.9 && !hit; dy += 0.02)
  for (let dx = 0.15; dx < 0.9; dx += 0.02) {
    const x = box.x + box.width * dx, y = box.y + box.height * dy;
    await page.mouse.move(x, y);
    if (await hot()) { hit = { x, y }; break; }
  }
const clip = { x: hit.x - 130, y: hit.y - 130, width: 260, height: 260 };
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/hint-on.png`, clip });
// Off the box entirely, so nothing is hovered.
await page.mouse.move(box.x + 6, box.y + box.height - 6);
await page.waitForTimeout(300);
console.log("still hot:", await hot());
await page.screenshot({ path: `${out}/hint-off.png`, clip });
await browser.close();
