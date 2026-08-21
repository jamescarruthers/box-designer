// Fillets fail on some boxes and not others. Vary the box and the radius
// together, one clean page each, and find the rule.
//
// The suspicion: the limit is not the radius against the panel thickness but
// the radius against the panel's own smallest dimension. Two fillets eating in
// from opposite edges of a narrow panel meet in the middle, and there is no
// surface left between them for OCCT to build.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function run({ size, radius, type = "fillet" }) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1300);
  const key = await page.evaluate(() => Object.keys(localStorage).find((k) => /box|design/i.test(k)));
  await page.evaluate(({ k, size, radius, type }) => {
    const base = JSON.parse(localStorage.getItem(k) ?? "{}");
    localStorage.setItem(k, JSON.stringify({
      ...base,
      start: { ...base.start, mode: "dimensions", basis: "internal", size },
      edge: { type, radius, perEdge: false, by: {} },
      fittings: [],
    }));
  }, { k: key, size, radius, type });
  await page.reload({ waitUntil: "domcontentloaded" });

  const t0 = Date.now();
  let out = "STUCK";
  while (Date.now() - t0 < 40000) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) { out = "ok"; break; }
    if (/ring-stack|Try again/.test(n)) { out = "FAIL"; break; }
    await page.waitForTimeout(120);
  }
  const env = await page.locator(".modes .stat").first().innerText().catch(() => "?");
  await page.close();
  return { out, env };
}

const BOXES = [
  ["deep box    ", { x: 300, y: 375, z: 480 }],
  ["shallow box ", { x: 300, y: 60, z: 480 }],
  ["narrow box  ", { x: 70, y: 200, z: 480 }],
  ["small cube  ", { x: 90, y: 90, z: 90 }],
];

for (const [label, size] of BOXES) {
  const line = [];
  for (const radius of [6, 12, 20, 30, 45]) {
    const { out } = await run({ size, radius });
    line.push(`r${String(radius).padStart(2)}:${out === "ok" ? "ok  " : out === "FAIL" ? "FAIL" : "??  "}`);
  }
  const { env } = await run({ size, radius: 6 });
  console.log(label, env.padEnd(22), line.join("  "));
}
await browser.close();
