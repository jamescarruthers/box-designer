// §46 A doubler rebated into the boards around it: the sidebar's panel list,
// the note it gives back, and the groove where it lands on the drawings.
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

const offered = () => page.evaluate(() =>
  [...document.querySelector('select[aria-label="Add a rebate"]').options].map((o) => o.textContent).join(" | "));
console.log("carcass only:", await offered());

await field("Add doublers").selectOption("top");
await page.waitForTimeout(400);
await field("Add cladding").selectOption("front");
await page.waitForTimeout(400);
console.log("with a doubler and cladding:", await offered());

await field("Add a rebate").selectOption("doubler|top");
await page.waitForTimeout(300);
await field("Top doubler rebate all sides").click();
await page.waitForTimeout(900);
console.log("note:", await page.locator(".rebate .note").first().textContent());
console.log("warnings:", await page.evaluate(() =>
  [...document.querySelectorAll(".messages li, .message")].map((n) => n.textContent).join(" / ") || "none"));

await page.locator(".controls").screenshot({ path: `${out}/doubler-rebate-sidebar.png` });
await page.locator(".modes button", { hasText: "Cut list" }).first().click();
await page.waitForTimeout(1200);
console.log("column:", await page.evaluate(() => {
  const head = [...document.querySelectorAll("table.cuts thead th")].map((t) => t.textContent);
  const at = head.indexOf("Rebate");
  return [...document.querySelectorAll("table.cuts tbody tr")]
    .map((r) => `${r.children[0].textContent}=${r.children[at].textContent || "—"}`).join(" ");
}));
console.log("template rects:", await page.evaluate(() =>
  document.querySelectorAll(".parts g.rebates rect").length));
await page.locator(".col-parts").screenshot({ path: `${out}/doubler-rebate-templates.png` });
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1500);
await page.locator(".sheet-holder svg").first().screenshot({ path: `${out}/doubler-rebate-sheet.png` });
console.log("groove lines on the section:", await page.evaluate(() =>
  document.querySelectorAll(".sheet-holder svg .hatch, .sheet-holder svg path").length));
await browser.close();
