import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("14");
// Clad the front and double the back.
const rows = page.locator(".reinf tbody tr");
await rows.nth(0).locator("input").nth(0).fill("6");   // front cladding
await rows.nth(1).locator("input").nth(1).fill("12");  // back doubler
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/app-fillet.png` });
await page.locator("#explode").fill("70");
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/app-explode.png` });
await page.getByRole("button", { name: "Drawing", exact: true }).click();
await page.waitForTimeout(500);
await page.locator(".sheet-holder").screenshot({ path: `${out}/app-drawing2.png` });
console.log(errs.length ? errs.join("\n") : "no page errors");
await browser.close();
