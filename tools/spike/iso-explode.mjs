// §38 The reworked sheet: section under the end view, the block pushed left,
// and an isometric that shows the cutouts and comes apart.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

await field("Add doublers").selectOption("front");
await field("Add a fitting").selectOption("driver");
await page.waitForTimeout(600);
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1200);

const frameCheck = () => page.evaluate(() => {
  const svg = document.querySelector(".sheet-holder svg");
  const frame = [...svg.querySelectorAll("rect")].find((r) => r.getAttribute("width") === "390");
  const f = ["x", "y", "width", "height"].map((k) => +frame.getAttribute(k));
  const spill = [];
  for (const el of svg.querySelectorAll("g[data-view] path, g[data-view] text, g[data-dims] text")) {
    const b = el.getBBox();
    if (b.x < f[0] - 0.5 || b.y < f[1] - 0.5 || b.x + b.width > f[0] + f[2] + 0.5 || b.y + b.height > f[1] + f[3] + 0.5)
      spill.push(`${el.tagName} ${el.textContent || ""} @${b.x.toFixed(1)},${b.y.toFixed(1)}`);
  }
  const cells = {};
  for (const g of svg.querySelectorAll("g[data-view]")) {
    const b = g.getBBox();
    cells[g.dataset.view] = `${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)}`;
  }
  const iso = svg.querySelector('g[data-view="iso"]');
  return { spill, cells, isoPaths: iso.querySelectorAll("path").length,
    isoFills: [...iso.querySelectorAll("path")].filter((p) => p.getAttribute("fill") === "var(--paper)").length };
});

console.log("in place:", JSON.stringify(await frameCheck(), null, 1));
await page.locator(".sheet-holder").screenshot({ path: `${out}/iso-place.png` });

await field("Explode isometric").fill("60");
await page.waitForTimeout(900);
console.log("exploded:", JSON.stringify(await frameCheck(), null, 1));
await page.locator(".sheet-holder").screenshot({ path: `${out}/iso-explode.png` });
await browser.close();
