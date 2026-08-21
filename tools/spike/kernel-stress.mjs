// "OpenCASCADE has stopped working again." Push it the way real use does: a box
// with several drivers, rapid edits while it is meshing, and the engine toggled
// under it. Report what the page says at every step.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGE ERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

const note = () => page.locator(".solid-state").innerText().catch(() => "(none)");
const settle = async (label, ms = 90000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = await note();
    if (/B-Rep/.test(n)) { console.log(`${label.padEnd(26)} ok   ${Math.round((Date.now()-t0)/100)/10}s  ${n.split("\n")[0]}`); return true; }
    if (/unavailable|would not|stopped|restarted/.test(n)) { console.log(`${label.padEnd(26)} FAIL      ${n.split("\n")[0]}`); return false; }
    await page.waitForTimeout(250);
  }
  console.log(`${label.padEnd(26)} STUCK     ${(await note()).split("\n")[0]}`);
  return false;
};

await settle("cold open");

// Three drivers, added quickly — each one re-derives and re-meshes.
for (let i = 0; i < 3; i++) {
  await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
  await page.waitForTimeout(120);
}
await settle("three drivers added");

// Rapid edits while it is meshing: the classic way to pile jobs up.
const field = page.locator(".controls").getByLabel("Fitting 1 cutout", { exact: true });
for (const v of ["90", "110", "130", "150", "170", "120"]) {
  await field.fill(v);
  await page.waitForTimeout(90);
}
await settle("six rapid edits");

// Toggle the engine under it, repeatedly.
for (let i = 0; i < 5; i++) {
  await page.getByRole("button", { name: "Analytic" }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "OpenCASCADE" }).click();
  await page.waitForTimeout(150);
}
await settle("five toggles");

// A big box with a big driver, which is real work for the kernel.
await page.getByRole("button", { name: "Dimensions" }).click();
for (const [l, v] of [["Width", "500"], ["Depth", "400"], ["Height", "1100"]]) {
  const f = page.locator(".controls").getByLabel(l, { exact: true });
  await f.fill(v); await f.blur();
}
await page.waitForTimeout(300);
await settle("big box", 120000);

// And a reload, which is what somebody does when it looks stuck.
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await settle("after reload", 120000);

if (errors.length) console.log("\nerrors:\n  " + [...new Set(errors)].slice(0, 10).join("\n  "));
await page.screenshot({ path: `${out}/stress.png` });
await browser.close();
