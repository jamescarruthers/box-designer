// §11 Does the built site work the way Pages serves it?
//
// Checks the three things that only hold in production: that the service worker
// gets the page cross-origin isolated after its reload, that the kernel loads
// and both engines answer, and — the point of moving the kernel into a worker —
// that the page stays responsive while it does.
//
//   npx vite build && node tools/spike/serve-plain.mjs &
//   node tools/spike/pages-check.mjs

import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:5099/";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
p.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 300)));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE error", m.text().slice(0, 250)); });

await p.goto(url, { waitUntil: "load" });
// The isolation reload replaces the document; poll until it stops moving.
let iso = false;
for (let i = 0; i < 30 && !iso; i++) {
  await p.waitForTimeout(500);
  iso = await p.evaluate(() => window.crossOriginIsolated).catch(() => false);
}
await p.waitForLoadState("load");
console.log("isolated:", iso, "| SAB:", await p.evaluate(() => typeof SharedArrayBuffer));

// 3D view
await p.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
const t0 = Date.now();
// While it loads, is the page still alive? Click something else and time it.
const clickStart = Date.now();
await p.getByRole("button", { name: "Wireframe", exact: true }).click();
console.log("UI responsive during kernel load: click took", Date.now() - clickStart, "ms");
await p.waitForFunction(() => {
  const el = document.querySelector(".solid-state");
  return el && /B-Rep|unavailable/.test(el.textContent);
}, null, { timeout: 120000 });
console.log("3D settled in", Date.now() - t0, "ms:", await p.locator(".solid-state").textContent());

// Drawing view through the kernel — the path that threw ReferenceError.
await p.getByRole("button", { name: "Drawing", exact: true }).click();
await p.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
const t1 = Date.now();
await p.waitForFunction(() => {
  const el = document.querySelector(".sheet-state, .engine-state, .kernel-state");
  return el && !/fetching|redrawing/i.test(el.textContent);
}, null, { timeout: 120000 }).catch(() => console.log("drawing state selector not found; dumping"));
console.log("drawing in", Date.now() - t1, "ms");
console.log("drawing status text:", await p.locator(".viewer-note, .sheet-state, .engine-state").allTextContents().catch(() => []));
if (process.argv[3]) await p.screenshot({ path: process.argv[3] });
await b.close();
