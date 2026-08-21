// §29 The flare where it can be seen: the section through the baffle, with the
// section plane moved onto the driver, square against filleted.
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

await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);
// A thick baffle and a big flare, so the section has something to show.
for (const [label, v] of [["Fitting 1 cutout", "116"], ["Fitting 1 flare", "0"]]) {
  const f = page.locator(".controls").getByLabel(label, { exact: true });
  if (await f.isEnabled()) { await f.fill(v); await f.blur(); }
}
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1000);
// The analytic drawing sections the walls only; the kernel one cuts the holes.
await page.locator(".sheet-chips .engine button", { hasText: "OpenCASCADE" }).first().click();
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/section-square.png` });

await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.locator(".controls .fitting-flare").getByRole("button", { name: "Fillet" }).click();
const r = page.locator(".controls").getByLabel("Fitting 1 flare", { exact: true });
await r.fill("12"); await r.blur();
await page.waitForTimeout(600);
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/section-flared.png` });
console.log("radius in the control:", await page.locator(".controls").getByLabel("Fitting 1 flare", { exact: true }).inputValue());
await browser.close();
