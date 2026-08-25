// §45 Rebates on the flat drawings: the cut list column, the part templates
// and the sheet layouts.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);

// A let-in baffle, so four panels carry a groove and one board grows.
await page.locator("label.field").filter({ has: page.getByText("Preset", { exact: true }) })
  .locator("select").selectOption("sides");
await field("Add a rebate").selectOption("front");
await page.waitForTimeout(300);
await field("Front rebate all sides").click();
await page.waitForTimeout(900);

await page.locator(".modes button", { hasText: "Cut list" }).first().click();
await page.waitForTimeout(1000);
console.log("column:", await page.evaluate(() => {
  const head = [...document.querySelectorAll("table.cuts thead th")].map((t) => t.textContent);
  const at = head.indexOf("Rebate");
  const cells = [...document.querySelectorAll("table.cuts tbody tr")]
    .map((r) => `${r.children[0].textContent}=${r.children[at].textContent || "—"}`);
  return `col ${at} of ${head.length} | ${cells.join(" ")}`;
}));
console.log("template rects:", await page.evaluate(() =>
  document.querySelectorAll(".parts g.rebates rect").length));
console.log("sheet rects:", await page.evaluate(() =>
  [...document.querySelectorAll(".col-sheets rect")].filter((r) => r.getAttribute("stroke") === "#3fb6c4").length));

await page.locator(".col-parts").screenshot({ path: `${out}/rebate-templates.png` });
await page.locator(".col-sheets").screenshot({ path: `${out}/rebate-sheets.png` });
await page.locator(".col-list").screenshot({ path: `${out}/rebate-column.png` });
await browser.close();
