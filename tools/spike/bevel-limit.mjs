// Where exactly does a bevel stop being cuttable? Sweep the radius against the
// panel thickness and find the largest one OCCT will take, so the rule that
// stops it can be the real limit rather than a guess.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const settle = async (ms = 45000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) return true;
    if (/ring-stack|Try again/.test(n)) return false;
    await page.waitForTimeout(150);
  }
  return false;
};

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const key = await page.evaluate(() => Object.keys(localStorage).find((k) => /box|design/i.test(k)));

async function tryIt({ thickness, type, radius }) {
  await page.evaluate(({ k, thickness, type, radius }) => {
    const base = JSON.parse(localStorage.getItem(k) ?? "{}");
    localStorage.setItem(k, JSON.stringify({
      ...base, thickness, perFaceThickness: false,
      thicknessBy: Object.fromEntries(["front", "back", "left", "right", "top", "bottom"].map((f) => [f, thickness])),
      edge: { type, radius, perEdge: false, by: {} },
      fittings: [],
    }));
  }, { k: key, thickness, type, radius });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  return settle();
}

for (const thickness of [12, 18, 25]) {
  for (const type of ["fillet", "chamfer"]) {
    // Largest radius that still meshes, to the nearest half millimetre.
    let lo = 0, hi = 60;
    while (hi - lo > 0.5) {
      const mid = Math.round(((lo + hi) / 2) * 2) / 2;
      if (await tryIt({ thickness, type, radius: mid })) lo = mid; else hi = mid;
    }
    console.log(`${String(thickness).padStart(2)} mm panel, ${type.padEnd(8)} largest that cuts: ${lo} mm  (ratio to thickness ${(lo / thickness).toFixed(2)})`);
  }
}
await browser.close();
