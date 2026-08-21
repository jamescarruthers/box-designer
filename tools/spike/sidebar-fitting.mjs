// Is the sidebar's fitting number actually clipped, or is scrollWidth counting
// the spinner? Measure the text against the room the padding leaves it.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.goto("http://localhost:5011/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);

const report = await page.evaluate(() => {
  const input = [...document.querySelectorAll(".controls .fitting-grid input")][1];
  const cs = getComputedStyle(input);
  const c = document.createElement("canvas").getContext("2d");
  c.font = `${cs.fontSize} ${cs.fontFamily}`;
  const rows = ["163.5", "1234.5", "12345.5"].map((v) => ({ v, text: Math.round(c.measureText(v).width) }));
  return {
    box: Math.round(input.getBoundingClientRect().width),
    padLeft: cs.paddingLeft, padRight: cs.paddingRight,
    room: Math.round(input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
    scroll: input.scrollWidth, client: input.clientWidth,
    rows,
  };
});
console.log(`box ${report.box}px · padding ${report.padLeft} / ${report.padRight} · text room ${report.room}px`);
console.log(`scrollWidth ${report.scroll} vs clientWidth ${report.client}`);
for (const r of report.rows) {
  console.log(`  "${r.v}" needs ${r.text}px → ${r.text <= report.room ? "fits" : "DOES NOT FIT"}`);
}
await page.locator(".controls .fitting").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.locator(".controls .fitting").screenshot({ path: `${out}/sidebar-fitting.png` });
await browser.close();
