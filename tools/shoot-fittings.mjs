// Add a driver and a port, then look at the templates and the sheet.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });

await page.getByLabel("Add a fitting").selectOption("driver");
await page.getByLabel("Add a fitting").selectOption("port");
// Put the driver high and the port low on the baffle.
await page.getByLabel("Fitting 1 at z").fill("230");
await page.getByLabel("Fitting 2 at z").fill("70");
await page.waitForTimeout(500);
await page.locator(".side").screenshot({ path: `${out}/fit-controls.png` });
await page.getByRole("button", { name: "Cut list & sheets", exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/fit-cuts.png` });
console.log(errs.length ? "ERRORS:\n" + errs.slice(0, 3).join("\n") : "no page errors");
await browser.close();
