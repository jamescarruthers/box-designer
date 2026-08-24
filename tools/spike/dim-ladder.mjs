// §37 Every interior dimensioned: does the ladder fit on the sheet, and does
// it still read on the worst case — clad, doubled and lined?
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

for (const face of ["front", "back", "left", "right", "top", "bottom"]) {
  await field("Add cladding").selectOption(face);
  await field("Add lagging").selectOption(face);
}
await field("Add doublers").selectOption("front");
await page.waitForTimeout(600);
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1500);

// Does anything fall outside the drawing frame?
const spill = await page.evaluate(() => {
  const svg = document.querySelector(".sheet-holder svg");
  const frame = [...svg.querySelectorAll("rect")].find((r) => r.getAttribute("width") === "390");
  const fx = +frame.getAttribute("x"), fy = +frame.getAttribute("y");
  const fw = +frame.getAttribute("width"), fh = +frame.getAttribute("height");
  const out = [];
  for (const t of svg.querySelectorAll("g[data-dims] text, g[data-dims] path")) {
    const b = t.getBBox();
    if (b.x < fx || b.y < fy || b.x + b.width > fx + fw || b.y + b.height > fy + fh) {
      out.push(`${t.tagName} ${t.textContent || ""} at ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    }
  }
  return out;
});
console.log("outside the frame:", spill.length ? spill.join(" | ") : "nothing");
console.log("dimension texts:", await page.evaluate(() =>
  [...document.querySelectorAll(".sheet-holder g[data-dims] text")].map((t) => t.textContent).join(" ")));
await page.locator(".sheet-holder").screenshot({ path: `${out}/dim-ladder.png` });
await browser.close();
