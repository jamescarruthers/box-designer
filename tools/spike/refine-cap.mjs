// §19 The Samples box starts at 30: what the box says, and how long the render
// it caps actually takes from pressing Refine to saying done.
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

await page.locator(".modes button", { hasText: "Render" }).first().click();
await page.waitForTimeout(1200);
console.log("Samples box starts at:", await page.locator("#max-samples").inputValue());

const note = () => page.locator(".render-state").innerText().catch(() => "");
console.log("before refining      :", await note());

const t0 = Date.now();
await page.getByRole("button", { name: "Refine", exact: true }).click();
let done = "";
while (Date.now() - t0 < 120000) {
  const n = await note();
  if (/done/.test(n)) { done = n; break; }
  await page.waitForTimeout(60);
}
console.log(`after ${((Date.now() - t0) / 1000).toFixed(1)}s          :`, done || "(never said done)");
await page.screenshot({ path: `${out}/refine-30.png` });

// And raising it carries on from where it got to, rather than starting over.
const box = page.locator("#max-samples");
await box.fill("120"); await box.blur();
const t1 = Date.now();
while (Date.now() - t1 < 120000) {
  const n = await note();
  if (/120 samples — done/.test(n)) break;
  await page.waitForTimeout(60);
}
console.log(`raised to 120, ${((Date.now() - t1) / 1000).toFixed(1)}s  :`, await note());
await browser.close();
