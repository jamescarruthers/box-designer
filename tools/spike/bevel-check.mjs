// One case at a time, from a clean slate each run, with the note read only
// after it has actually changed. The bisection before this reused a page and
// believed a note left over from the previous design.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function run(patch, label) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  const key = await page.evaluate(() => Object.keys(localStorage).find((k) => /box|design/i.test(k)));
  await page.evaluate(({ k, p }) => {
    const base = JSON.parse(localStorage.getItem(k) ?? "{}");
    localStorage.setItem(k, JSON.stringify({ ...base, ...p }));
  }, { k: key, p: patch });
  await page.reload({ waitUntil: "domcontentloaded" });

  const t0 = Date.now();
  let out = "STUCK";
  while (Date.now() - t0 < 45000) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) { out = "ok"; break; }
    if (/ring-stack|Try again/.test(n)) { out = "FAIL " + n.split("—")[0].trim(); break; }
    await page.waitForTimeout(150);
  }
  console.log(label.padEnd(46), out);
  await page.close();
  return out === "ok";
}

const edge = (type, radius) => ({ edge: { type, radius, perEdge: false, by: {} } });
const thick = (t) => ({
  thickness: t, perFaceThickness: false,
  thicknessBy: Object.fromEntries(["front", "back", "left", "right", "top", "bottom"].map((f) => [f, t])),
});

// Radius alone, on the stock 18 mm box.
for (const r of [12, 16, 18, 20, 24, 30]) await run(edge("fillet", r), `18 mm panel, fillet ${r}`);
// And against thickness, at a radius that failed.
for (const t of [12, 18, 25, 30]) await run({ ...thick(t), ...edge("fillet", 24) }, `${t} mm panel, fillet 24`);
for (const t of [12, 18, 25, 30]) await run({ ...thick(t), ...edge("chamfer", 24) }, `${t} mm panel, chamfer 24`);
await browser.close();
