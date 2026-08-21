// §30 Lagging in the app: line the box, and see where it goes — the size, the
// cavity, the cut list, the 3D stack and the section hatching.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const stat = () => page.locator(".modes .stat").first().innerText();
const readout = (label) => page.locator(".readout div").filter({ hasText: label })
  .locator("dd").innerText().catch(() => "(none)");
const settle = async (ms = 90000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) return n.replace(/\n/g, " ");
    if (/Try again/.test(n)) return `FAILED: ${n.replace(/\n/g, " ")}`;
    await page.waitForTimeout(150);
  }
  return "STUCK";
};

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
console.log("bare  ", await stat(), "| cavity", await readout("Cavity"), "|", await settle());

for (const face of ["front", "back", "left", "right", "top", "bottom"]) {
  await page.locator(".controls").getByLabel("Add lagging", { exact: true }).selectOption(face);
}
await page.waitForTimeout(500);
console.log("lined ", await stat(), "| cavity", await readout("Cavity"), "|", await settle());
console.log("bevel note:", (await page.locator(".controls .group").filter({ hasText: "Edge treatment" })
  .locator(".note").last().innerText()).replace(/\n/g, " "));

// The cut list, and what it is nested on.
await page.locator(".modes button", { hasText: "Cut list" }).first().click();
await page.waitForTimeout(700);
const rows = await page.locator("table.cuts tbody tr").allInnerTexts();
console.log("lagging rows:", rows.filter((r) => /Lagging/.test(r)).length);
console.log("  eg:", rows.find((r) => /Lagging/.test(r))?.replace(/\s+/g, " ").slice(0, 90));
console.log("sheets:", (await page.locator(".sheet-head, .sheet-title, h3").allInnerTexts()).filter((t) => /felt|Felt|Birch/.test(t)).join(" | ").slice(0, 160));
await page.screenshot({ path: `${out}/lagging-cuts.png` });

// The section, where a lining should not read as a board.
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1200);
await page.locator(".sheet-chips .engine button", { hasText: "OpenCASCADE" }).click();
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/lagging-section.png` });

// And the 3D stack.
await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.locator("#explode").fill("60");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/lagging-3d.png` });
await browser.close();
