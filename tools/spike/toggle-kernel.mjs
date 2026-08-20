// Does the OpenCASCADE toggle survive being switched on and off repeatedly?
//
// Reported from the field: "it's not reliably switching on and off again".
// This drives the real toggle in a real browser and records every state the
// status line passes through, so a toggle that quietly does nothing is visible
// as an absence rather than having to be inferred from a single late sample.
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5011";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" || /stall|restart/i.test(t)) console.log(`    [${m.type()}] ${t}`);
});
page.on("pageerror", (e) => console.log("    [pageerror]", e.message));

await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

// Every change of the status line, in the page, at 40 ms.
await page.evaluate(() => {
  window.__trace = [];
  let last = null;
  setInterval(() => {
    const el = document.querySelector(".solid-state");
    const now = el ? el.textContent.replace(/\s+/g, " ").trim() : "(engine off)";
    if (now !== last) { window.__trace.push([Math.round(performance.now()), now]); last = now; }
  }, 40);
});

const trace = async () => page.evaluate(() => window.__trace.splice(0));
const on = () => page.getByRole("button", { name: "OpenCASCADE" }).click();
const off = () => page.getByRole("button", { name: "Analytic" }).click();

/** Settled: the same non-working reading three times running. */
async function settle(ms = 120_000) {
  const t0 = Date.now();
  let seen = null, runs = 0;
  for (;;) {
    const el = page.locator(".solid-state");
    const s = (await el.count()) ? (await el.innerText()).replace(/\s+/g, " ").trim() : "(engine off)";
    runs = s === seen ? runs + 1 : 0;
    seen = s;
    if (runs >= 3 && !/…$/.test(s)) return s || "(idle — nothing happening)";
    if (Date.now() - t0 > ms) return `STUCK after ${Math.round((Date.now() - t0) / 1000)} s: ${s}`;
    await page.waitForTimeout(200);
  }
}

async function cycle(label, fn) {
  await fn();
  const result = await settle();
  const seen = (await trace()).map(([, s]) => s || "(idle)").join(" › ");
  console.log(`— ${label}\n  → ${result}\n    via ${seen}`);
}

await cycle("on, from cold", on);
await cycle("off then on", async () => { await off(); await on(); });

for (const delay of [50, 400, 1200]) {
  await cycle(`off part-way through (${delay} ms in)`, async () => {
    await off(); await on(); await page.waitForTimeout(delay); await off();
    await page.waitForTimeout(120); await on();
  });
}

await cycle("flapped six times", async () => {
  for (let i = 0; i < 6; i++) { await off(); await on(); }
});

// Now on a box that is real work: two fittings, so every mesh is a boolean cut
// rather than six boxes.
await page.getByLabel("Add a fitting").selectOption("driver");
await page.getByLabel("Add a fitting").selectOption("port");
await cycle("with fittings, settled", async () => {});
await cycle("with fittings, flapped six times", async () => {
  for (let i = 0; i < 6; i++) { await off(); await on(); }
});
await cycle("with fittings, edited while on", async () => {
  await page.getByLabel("Volume").fill("24");
});
await cycle("with fittings, edited six times quickly", async () => {
  for (const v of [25, 26, 27, 28, 29, 30]) await page.getByLabel("Volume").fill(String(v));
});

// The drawing shares the one worker, so ask both at once.
await page.getByRole("button", { name: "Drawing" }).click();
await page.getByRole("button", { name: "OpenCASCADE" }).click();
await page.waitForTimeout(4000);
const drawing = await page.locator(".engine .note, .drawing-state, .engine-state").allInnerTexts().catch(() => []);
console.log("— drawing on the same worker\n  →", JSON.stringify(drawing).slice(0, 200));
await page.getByRole("button", { name: "3D view" }).click();
console.log("  3D after the drawing ran →", await settle(30_000));

await browser.close();
