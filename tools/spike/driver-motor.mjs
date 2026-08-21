// §24 The rest of the driver: magnet and basket behind the baffle. Visible in
// the see-through 3D view and when the box is exploded, which is the only place
// the back of a driver is ever in shot.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("http://localhost:5012/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);
// The Pluvia 7P, every number off its datasheet.
for (const [label, v] of [
  ["Fitting 1 cutout", "100"], ["Fitting 1 outer", "122.3"], ["Fitting 1 pcd", "112"],
  ["Fitting 1 bolts", "5"], ["Fitting 1 boltHole", "3.1"],
  ["Fitting 1 depth", "71.5"], ["Fitting 1 magnet", "75.8"], ["Fitting 1 magnetDepth", "37"],
]) {
  // Exact: "Fitting 1 magnet" is a prefix of "Fitting 1 magnetDepth".
  const f = page.locator(".controls").getByLabel(label, { exact: true });
  await f.fill(v); await f.blur();
}
await page.locator(".controls .fitting-units").getByRole("button", { name: "% of panel" }).click();
for (const l of ["Fitting 1 at x", "Fitting 1 at z"]) {
  const f = page.locator(".controls").getByLabel(l); await f.fill("50"); await f.blur();
}
await page.waitForTimeout(600);
console.log("described:", await page.locator(".controls .fitting .note").innerText());
console.log("messages :", (await page.locator(".messages").innerText().catch(() => "(none)")).slice(0, 200) || "(none)");

for (let i = 0; i < 90; i++) {
  const n = await page.locator(".solid-state").innerText().catch(() => "");
  if (/B-Rep/.test(n)) { console.log("kernel   :", n.split("\n")[0]); break; }
  await page.waitForTimeout(1000);
}

// See-through, from the side: the motor stands in the cavity.
await page.getByRole("button", { name: "right", exact: true }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/motor-side.png` });

// Exploded, so the driver comes away from the baffle with it.
const slider = page.locator("#explode");
await slider.fill("70");
await page.getByRole("button", { name: "iso", exact: true }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/motor-exploded.png` });
await browser.close();
