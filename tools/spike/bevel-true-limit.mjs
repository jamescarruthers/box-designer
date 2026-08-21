// §26 Where does OCCT actually stop accepting a fillet? Now that a refused
// panel is reported rather than losing the box, the answer is readable straight
// off the note: sweep the radius and watch when panels start being refused.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function refusedAt({ thickness, radius, type }) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ t, r, ty }) => localStorage.setItem("sheet-box-designer/design/1",
    JSON.stringify({
      thickness: t, perFaceThickness: false,
      thicknessBy: Object.fromEntries(["front","back","left","right","top","bottom"].map((f) => [f, t])),
      edge: { type: ty, radius: r, perEdge: false, by: {} },
    })), { t: thickness, r: radius, ty: type });
  await page.reload({ waitUntil: "domcontentloaded" });
  let note = "", out = "STUCK";
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    note = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(note)) { out = /would not cut/.test(note) ? Number(note.match(/· (\d+) panels?/)?.[1] ?? 0) : 0; break; }
    if (/Try again/.test(note)) { out = "ALL"; break; }
    await page.waitForTimeout(120);
  }
  await page.close();
  return out;
}

for (const type of ["fillet", "chamfer"]) {
  for (const thickness of [12, 18]) {
    const row = [];
    for (const r of [0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0]) {
      const radius = Math.round(thickness * r * 100) / 100;
      const n = await refusedAt({ thickness, radius, type });
      row.push(`${String(r).padEnd(4)}(${String(radius).padStart(5)}): ${n === 0 ? "ok" : n + " refused"}`);
    }
    console.log(`${type.padEnd(8)} ${thickness} mm wall`);
    for (const r of row) console.log("   ", r);
  }
}
await browser.close();
