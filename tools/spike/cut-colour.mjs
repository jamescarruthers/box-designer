// §50 The colour in the cut list: the column, the two sheets a two-tone box
// nests onto, and the tally that counts them as two orders.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);

// Valchromat in Green Mint, with a red front.
const sheet = page.locator(".controls").getByLabel("Stock").locator("xpath=../..").locator("select").first();
await page.locator(".controls .group").filter({ hasText: "Material" }).first()
  .locator("select").first().selectOption("valchromat");
await page.waitForTimeout(500);
await page.getByLabel("Sheet colour name").selectOption("#548772");
await page.waitForTimeout(500);
await page.getByLabel("Open the Front carcass").click();
await page.waitForTimeout(400);
await page.getByLabel("Front colour name").selectOption("#da646c");
await page.waitForTimeout(600);
await page.getByLabel("Close the panel inspector").click();
await page.waitForTimeout(400);

await page.locator(".modes button", { hasText: "Cut list" }).first().click();
await page.waitForTimeout(1200);
console.log("head:", await page.evaluate(() =>
  [...document.querySelectorAll("table.cuts thead th")].map((t) => t.textContent).join(" | ")));
console.log("colours:", await page.evaluate(() => {
  const head = [...document.querySelectorAll("table.cuts thead th")].map((t) => t.textContent);
  const at = head.indexOf("Colour");
  return [...document.querySelectorAll("table.cuts tbody tr")]
    .map((r) => `${r.children[0].textContent}=${r.children[at].textContent}`).join(" ");
}));
console.log("sheets:", await page.evaluate(() =>
  [...document.querySelectorAll(".col-sheets figcaption")].map((f) => f.textContent.trim()).join(" | ")));
console.log("tally:", await page.evaluate(() =>
  [...document.querySelectorAll(".by-material tr")].map((r) => r.textContent.trim()).join(" | ")));
await page.locator(".col-list").screenshot({ path: `${out}/cut-colour.png` });
await page.locator(".col-sheets").screenshot({ path: `${out}/cut-colour-sheets.png` });
await browser.close();
