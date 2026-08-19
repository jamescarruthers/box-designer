// Drive the drawing mode onto the OpenCASCADE engine and screenshot the result.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
console.log("crossOriginIsolated:", await page.evaluate(() => window.crossOriginIsolated));

await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("12");
await page.getByRole("button", { name: "Drawing", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();

// Wait for the state chip to stop saying it is working.
await page.waitForFunction(() => {
  const el = document.querySelector(".engine-state");
  return el && !/fetching|redrawing/.test(el.textContent);
}, null, { timeout: 240000 });

console.log("engine state:", (await page.locator(".engine-state").textContent()).trim());
await page.locator(".sheet-holder").screenshot({ path: `${out}/kernel-sheet.png` });
console.log(errs.length ? "ERRORS:\n" + errs.slice(0, 5).join("\n") : "no page errors");
await browser.close();
