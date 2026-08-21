// A close look at the driver on the panel, and the same view with it switched
// off — the difference is what the driver is actually contributing.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("http://localhost:5011/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);
for (const [label, value] of [["Fitting 1 cutout", "100"], ["Fitting 1 outer", "122.3"], ["Fitting 1 pcd", "112"]]) {
  const f = page.locator(".controls").getByLabel(label);
  await f.fill(value); await f.blur();
}
await page.locator(".controls .fitting-units").getByRole("button", { name: "% of panel" }).click();
for (const l of ["Fitting 1 at x", "Fitting 1 at z"]) {
  const f = page.locator(".controls").getByLabel(l);
  await f.fill("50"); await f.blur();
}
// Shaded, face-on, so the driver fills the frame.
await page.locator(".pane-view .chip-group button", { hasText: "Shaded" }).first().click();
await page.getByRole("button", { name: "front", exact: true }).click();
await page.waitForTimeout(800);

const clip = { x: 700, y: 250, width: 500, height: 500 };
await page.screenshot({ path: `${out}/close-on.png`, clip });
await page.locator(".pane-view .chip-group button", { hasText: "Drivers" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/close-off.png`, clip });
await browser.close();
