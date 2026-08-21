// Does the kernel wear out? One page, left open, edited over and over — which
// is what somebody actually does with it, and what the earlier sweep was doing
// by accident when it started failing.
//
// Reported as "working: <a number> — showing the ring-stack solids". A bare
// number is an OCCT exception surfacing as the pointer Emscripten throws, and
// an out-of-memory inside the kernel arrives exactly that way: as a C++ throw,
// not as a JS RangeError, so nothing upstream recognises it as memory.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5013/";
const rounds = Number(process.env.ROUNDS ?? 60);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

const settle = async (ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) return { ok: true, note: n.split("\n")[0] };
    if (/ring-stack|Try again/.test(n)) return { ok: false, note: n.split("—")[0].trim() };
    await page.waitForTimeout(120);
  }
  return { ok: false, note: "STUCK" };
};

console.log("first mesh:", (await settle()).note);
// Something with real work in it, so each round is a proper mesh.
await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);
await settle();

const heap = () => page.evaluate(() => performance.memory
  ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1);

const cutout = page.locator(".controls").getByLabel("Fitting 1 cutout", { exact: true });
let failedAt = 0;
for (let i = 1; i <= rounds; i++) {
  // A different size every round, so nothing is cached and each is real work.
  await cutout.fill(String(80 + (i % 40) * 2));
  await cutout.blur();
  const r = await settle();
  if (i % 10 === 0 || !r.ok) {
    console.log(`round ${String(i).padStart(3)}  heap ${String(await heap()).padStart(4)} MB  ${r.ok ? "ok" : "FAIL"}  ${r.note}`);
  }
  if (!r.ok) { failedAt = i; break; }
}
console.log(failedAt ? `\nfailed on round ${failedAt}` : `\nsurvived all ${rounds} rounds`);
await browser.close();
