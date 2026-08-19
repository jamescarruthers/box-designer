// Show the edge-treatment controls with the per-edge list open.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("14");
await page.getByLabel("Per edge").check();
await page.waitForTimeout(500);
await page.locator(".side").screenshot({ path: `${out}/edge-controls.png` });
await page.screenshot({ path: `${out}/edge-warning.png` });
console.log(errs.length ? errs.join("\n") : "no page errors");
await browser.close();
