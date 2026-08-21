// Does a design the validator complains about still mesh? A fitting bigger than
// its panel, one hanging over the edge, one at zero — each is something a user
// can type, and each is a boolean the kernel has to survive.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGE ERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

const CASES = [
  ["cutout bigger than the panel", { cutout: 900, outer: 950, pcd: 920 }],
  ["cutout exactly the panel",     { cutout: 218, outer: 240, pcd: 230 }],
  ["zero cutout",                  { cutout: 0, outer: 100, pcd: 60 }],
  ["driver deeper than the box",   { cutout: 100, outer: 122, depth: 900, magnet: 80, magnetDepth: 400 }],
  ["magnet wider than cutout",     { cutout: 100, outer: 122, magnet: 300, depth: 120, magnetDepth: 60 }],
  ["bolts on a huge PCD",          { cutout: 100, outer: 122, pcd: 900, bolts: 24, boltHole: 20 }],
];

for (const [name, fields] of CASES) {
  await page.goto(app, { waitUntil: "domcontentloaded" });
  // Seed the design straight into storage, the way a returning user arrives.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
  await page.waitForTimeout(250);
  for (const [k, v] of Object.entries(fields)) {
    const label = { cutout: "cutout", outer: "outer", pcd: "pcd", bolts: "bolts", boltHole: "boltHole",
                    depth: "depth", magnet: "magnet", magnetDepth: "magnetDepth" }[k];
    const f = page.locator(".controls").getByLabel(`Fitting 1 ${label}`, { exact: true });
    await f.fill(String(v)); await f.blur();
    await page.waitForTimeout(60);
  }
  const t0 = Date.now();
  let verdict = "STUCK";
  while (Date.now() - t0 < 60000) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) { verdict = `ok  ${n.split("\n")[0]}`; break; }
    if (/unavailable|would not|stopped|restarted/.test(n)) { verdict = "FAIL " + n.split("\n")[0]; break; }
    await page.waitForTimeout(250);
  }
  console.log(name.padEnd(30), Math.round((Date.now() - t0) / 100) / 10 + "s", verdict);
}
if (errors.length) console.log("\nerrors:\n  " + [...new Set(errors)].slice(0, 8).join("\n  "));
await browser.close();
