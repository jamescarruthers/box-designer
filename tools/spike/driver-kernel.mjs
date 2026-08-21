// The same driver with the kernel on, which is the mode that actually cuts the
// hole the cone sits in.
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
for (const [label, value] of [["Fitting 1 cutout", "100"], ["Fitting 1 outer", "122.3"], ["Fitting 1 pcd", "112"], ["Fitting 1 boltHole", "3.1"]]) {
  const f = page.locator(".controls").getByLabel(label);
  await f.fill(value); await f.blur();
}
await page.locator(".controls .fitting-units").getByRole("button", { name: "% of panel" }).click();
for (const l of ["Fitting 1 at x", "Fitting 1 at z"]) {
  const f = page.locator(".controls").getByLabel(l);
  await f.fill("50"); await f.blur();
}
await page.waitForTimeout(500);

await page.getByRole("button", { name: "OpenCASCADE" }).click();
// The kernel has to fetch and run; wait for it to say it is done.
for (let i = 0; i < 60; i++) {
  const note = await page.locator(".solid-state").innerText().catch(() => "");
  if (/B-Rep/.test(note)) { console.log("kernel:", note.split("\n")[0]); break; }
  await page.waitForTimeout(1000);
}
await page.locator(".pane-view .chip-group button", { hasText: "Shaded" }).first().click();
await page.getByRole("button", { name: "front", exact: true }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/kernel-front.png`, clip: { x: 700, y: 250, width: 500, height: 500 } });
await page.getByRole("button", { name: "iso", exact: true }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/kernel-iso.png` });

await page.getByRole("button", { name: "Render" }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/kernel-render.png` });
await browser.close();
