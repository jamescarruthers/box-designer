// §22 Does one shape serve every driver? Three sizes on one baffle, side by
// side, at the sizes their datasheets give.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("http://localhost:5012/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

// A tall baffle to stack them on.
await page.getByRole("button", { name: "Dimensions" }).click();
for (const [label, v] of [["Width", "420"], ["Depth", "300"], ["Height", "900"]]) {
  const f = page.locator(".controls").getByLabel(label, { exact: true });
  await f.fill(v); await f.blur();
}
await page.waitForTimeout(500);

// 15 inch, 6.5 inch, 2 inch — biggest at the bottom, as they would be fitted.
const DRIVERS = [
  { cutout: "350", outer: "390", pcd: "370", bolts: "8", bolt: "6", at: [50, 25] },
  { cutout: "146", outer: "170", pcd: "160", bolts: "4", bolt: "5", at: [50, 60] },
  { cutout: "45",  outer: "57",  pcd: "51",  bolts: "4", bolt: "3", at: [50, 85] },
];
for (let i = 0; i < DRIVERS.length; i++) {
  const d = DRIVERS[i];
  await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
  await page.waitForTimeout(300);
  const n = i + 1;
  for (const [label, v] of [
    [`Fitting ${n} cutout`, d.cutout], [`Fitting ${n} outer`, d.outer],
    [`Fitting ${n} pcd`, d.pcd], [`Fitting ${n} bolts`, d.bolts], [`Fitting ${n} boltHole`, d.bolt],
  ]) {
    const f = page.locator(".controls").getByLabel(label);
    await f.fill(v); await f.blur();
  }
  await page.locator(`.controls .fitting`).nth(i).locator(".fitting-units")
    .getByRole("button", { name: "% of panel" }).click();
  await page.waitForTimeout(200);
  for (const [label, v] of [[`Fitting ${n} at x`, String(d.at[0])], [`Fitting ${n} at z`, String(d.at[1])]]) {
    const f = page.locator(".controls").getByLabel(label);
    await f.fill(v); await f.blur();
  }
  await page.waitForTimeout(300);
}

for (let i = 0; i < 90; i++) {
  const note = await page.locator(".solid-state").innerText().catch(() => "");
  if (/B-Rep/.test(note)) { console.log("kernel:", note.split("\n")[0]); break; }
  await page.waitForTimeout(1000);
}
console.log("messages:", (await page.locator(".messages").innerText().catch(() => "(none)")).slice(0, 300));

await page.locator(".pane-view .chip-group button", { hasText: "Shaded" }).first().click();
await page.getByRole("button", { name: "front", exact: true }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/sizes-front.png` });
await page.getByRole("button", { name: "Render" }).click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/sizes-render.png` });
await browser.close();
