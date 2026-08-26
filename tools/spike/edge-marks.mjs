// §48 The edge treatments on the part templates and in the DXF: the same mark
// in both, on the edge the saw is actually set over for.
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

// A ring of mitres, plus a rounded edge, plus a driver with blind bolt holes.
await page.locator(".controls").getByText("Per edge").click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Mitre a ring of/ }).click();
await page.waitForTimeout(700);
await page.getByLabel("Open the Front carcass").click();
await page.waitForTimeout(400);
await page.getByLabel("Add a fitting to the front").selectOption("driver");
await page.waitForTimeout(700);
await page.getByLabel("Fitting 1 boltDeep").fill("12");
await page.getByLabel("Fitting 1 boltDeep").dispatchEvent("change");
await page.waitForTimeout(700);

// §21 The templates column is the one the cut list gives up while a panel is
// open, so the inspector has to be closed to look at them.
await page.getByLabel("Close the panel inspector").click();
await page.waitForTimeout(500);
await page.locator(".modes button", { hasText: "Cut list" }).first().click();
await page.waitForTimeout(1200);
console.log("edge column:", await page.evaluate(() =>
  [...document.querySelectorAll("table.cuts tbody tr")]
    .map((r) => `${r.children[0].textContent}=${r.children[8].textContent}`).join(" ")));
console.log("marks drawn:", await page.evaluate(() =>
  document.querySelectorAll(".parts g.edge-marks line").length));
console.log("mark words:", await page.evaluate(() =>
  [...new Set([...document.querySelectorAll(".parts g.edge-marks text")].map((t) => t.textContent))].join(" | ")));
await page.locator(".col-parts").screenshot({ path: `${out}/edge-marks-templates.png`, timeout: 15000 });
await browser.close();
