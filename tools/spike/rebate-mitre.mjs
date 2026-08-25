// §43 A top panel let into a box whose corners are mitred: all four sides, and
// the closure still exact.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

// Mitre the four vertical corners: the "mitred set of panels".
// Per-edge first, then "Mitre a ring of 4" — the four vertical corners.
await page.locator(".controls").getByLabel("Per edge").check();
await page.waitForTimeout(400);
await page.locator(".controls").getByRole("button", { name: /^Mitre a ring of/ }).click();
await page.waitForTimeout(800);

await field("Add a rebate").selectOption("top");
await page.waitForTimeout(300);
await field("Top rebate all sides").click();
await page.waitForTimeout(900);
console.log("notes:", (await page.locator(".rebate .note").allInnerTexts()).join(" | "));
console.log("closure:", await page.evaluate(() => {
  const t = [...document.querySelectorAll(".totals div")].find((d) => /Closure/.test(d.textContent));
  return t ? t.textContent : "(not on this screen)";
}));
await page.locator(".controls").screenshot({ path: `${out}/rebate-mitre-controls.png` });
await page.locator(".modes button", { hasText: "Cut list" }).first().click();
await page.waitForTimeout(900);
console.log("closure:", await page.locator(".totals").innerText());
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1400);
await page.locator(".sheet-holder").screenshot({ path: `${out}/rebate-mitre-sheet.png` });
await browser.close();
