// The engine toggle over a slow line, which is where it was reported broken.
//
// dist/ served with no headers at a fixed byte rate, so the 9.3 MB kernel takes
// the best part of a minute — long enough to switch it off and on again three
// times while it is still coming down, which is what a person does when a
// toggle looks like it has not done anything.
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5099";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
page.on("console", (m) => {
  if (m.type() === "error" || /stall|restart/i.test(m.text())) console.log(`    [${m.type()}] ${m.text()}`);
});

await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "load" });                  // let the service worker take
console.log("isolated:", await page.evaluate(() => crossOriginIsolated));

await page.evaluate(() => {
  window.__trace = [];
  let last = null;
  setInterval(() => {
    const el = document.querySelector(".solid-state");
    const now = el ? el.textContent.replace(/\s+/g, " ").trim() : "(engine off)";
    if (now !== last) { window.__trace.push([Math.round(performance.now() / 100) / 10, now]); last = now; }
  }, 40);
});

const on = () => page.getByRole("button", { name: "OpenCASCADE" }).click();
const off = () => page.getByRole("button", { name: "Analytic" }).click();

await page.getByLabel("Add a fitting").selectOption("driver");
await on();
// Three impatient goes at it while the download is still running.
for (const wait of [4000, 5000, 6000]) {
  await page.waitForTimeout(wait);
  await off();
  await page.waitForTimeout(400);
  await on();
}

const t0 = Date.now();
let final = "";
for (;;) {
  final = await page.locator(".solid-state").innerText().catch(() => "");
  if (final && !/…/.test(final)) break;
  if (Date.now() - t0 > 240_000) { final = `STUCK: ${final}`; break; }
  await page.waitForTimeout(500);
}
console.log("final:", final.replace(/\s+/g, " "), `after ${Math.round((Date.now() - t0) / 1000)} s of waiting`);
for (const [t, s] of await page.evaluate(() => window.__trace)) console.log(`  ${t}s  ${s}`);

await browser.close();
