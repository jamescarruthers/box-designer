// §28 Vd by name: what the readout says before a driver has one, and after.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5016/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const readout = async (label) => {
  const dd = page.locator(".readout div").filter({ hasText: label }).locator("dd");
  return `${await dd.innerText().catch(() => "(none)")}   [${await dd.getAttribute("title").catch(() => "") ?? ""}]`;
};

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);

await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(500);
console.log("before a Vd is given:");
console.log("  field label:", await page.locator(".controls .fitting-grid .field")
  .filter({ hasText: "Vd" }).locator("span").first().innerText());
console.log("  net        :", await readout("Net"));

const vd = page.locator(".controls").getByLabel("Fitting 1 displaces", { exact: true });
console.log("  shows      :", await vd.inputValue(), "l (worked out from the shape)");

// The datasheet's figure for a driver of this size.
await vd.fill("0.18"); await vd.blur();
await page.waitForTimeout(600);
console.log("after Vd = 0.18 l:");
console.log("  field label:", await page.locator(".controls .fitting-grid .field")
  .filter({ hasText: "Vd" }).locator("span").first().innerText());
console.log("  net        :", await readout("Net"));

await page.locator(".controls .fitting").scrollIntoViewIfNeeded();
await page.locator(".controls .fitting").screenshot({ path: `${out}/vd-field.png` });
await browser.close();
