// §27 Cone depth as a real number, and the volume left for the air once the
// driver is standing in the box.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5014/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const readout = (label) => page.locator(".readout div").filter({ hasText: label })
  .locator("dd").innerText().catch(() => "(none)");

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);
console.log("empty box   cavity", await readout("Cavity"), "| net", await readout("Net"));

// A 15 inch woofer, whose cone is nearer 95 mm than the 73 a ratio would guess.
await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);
for (const [label, v] of [
  ["Fitting 1 cutout", "350"], ["Fitting 1 outer", "390"], ["Fitting 1 pcd", "370"],
  ["Fitting 1 depth", "180"], ["Fitting 1 magnet", "160"], ["Fitting 1 magnetDepth", "70"],
]) {
  const f = page.locator(".controls").getByLabel(label, { exact: true });
  await f.fill(v); await f.blur();
}
await page.waitForTimeout(400);
const cone = page.locator(".controls").getByLabel("Fitting 1 coneDepth", { exact: true });
console.log("cone depth, guessed from the cutout:", await cone.inputValue(), "mm");
await cone.fill("95"); await cone.blur();
await page.waitForTimeout(500);
console.log("cone depth, from the datasheet     :", await cone.inputValue(), "mm");
console.log("with the woofer  cavity", await readout("Cavity"), "| net", await readout("Net"));
console.log("describes:", await page.locator(".controls .fitting .note").innerText());

// And a port through it as well.
await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("port");
await page.waitForTimeout(600);
console.log("plus a port      cavity", await readout("Cavity"), "| net", await readout("Net"));

await page.locator(".pane-view .chip-group button", { hasText: "Shaded" }).first().click();
await page.getByRole("button", { name: "right", exact: true }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/deep-cone.png` });
await browser.close();
