// §22 Put a real driver on the box and look at it: 3D view, render, and the
// toggle. The datasheet is the Markaudio Pluvia 7P.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
await page.goto("http://localhost:5011/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);

// Dial in the Pluvia 7P.
for (const [label, value] of [
  ["Fitting 1 cutout", "100"], ["Fitting 1 outer", "122.3"],
  ["Fitting 1 pcd", "112"], ["Fitting 1 bolts", "5"], ["Fitting 1 boltHole", "3.1"],
]) {
  const f = page.locator(".controls").getByLabel(label);
  await f.fill(value); await f.blur();
}
// Centred on the front, as a proportion so it stays there.
await page.locator(".controls .fitting-units").getByRole("button", { name: "% of panel" }).click();
await page.waitForTimeout(300);
for (const l of ["Fitting 1 at x", "Fitting 1 at z"]) {
  const f = page.locator(".controls").getByLabel(l);
  await f.fill("50"); await f.blur();
}
await page.waitForTimeout(600);
console.log("described:", await page.locator(".controls .fitting .note").innerText());

await page.getByRole("button", { name: "front", exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/driver-3d-front.png` });
await page.getByRole("button", { name: "iso", exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/driver-3d-iso.png` });

// The toggle takes it away and puts it back.
const chip = page.locator(".pane-view .chip-group button", { hasText: "Drivers" });
const pixels = () => page.evaluate(async () => {
  const c = document.querySelector(".pane-view canvas");
  const bmp = await createImageBitmap(c);
  const oc = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = oc.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  // Count near-black pixels: the driver frame is the only black thing in shot.
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 45 && d[i+1] < 45 && d[i+2] < 50 && d[i+3] > 200) dark++;
  return dark;
});
const withDriver = await pixels();
await chip.click(); await page.waitForTimeout(600);
const without = await pixels();
await chip.click(); await page.waitForTimeout(600);
const back = await pixels();
console.log(`frame pixels — on ${withDriver}, off ${without}, on again ${back}`);

// And the render.
await page.getByRole("button", { name: "Render" }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/driver-render.png` });
await page.getByRole("button", { name: "Refine" }).click();
await page.waitForTimeout(9000);
console.log("trace:", await page.locator(".render-state").innerText());
await page.screenshot({ path: `${out}/driver-traced.png` });

await browser.close();
