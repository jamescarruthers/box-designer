// The user's exact path: no COOP/COEP, fresh session, one click.
import { chromium } from "playwright-core";
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
let reloads = 0;
page.on("framenavigated", (f) => { if (f === page.mainFrame()) reloads++; });
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 160)));

const t0 = Date.now();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".chip-group", { timeout: 30000 });
console.log(`first paint after ${Date.now() - t0} ms, navigations so far: ${reloads}`);
console.log("isolated before any click:", await page.evaluate(() => window.crossOriginIsolated));

await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
const navsAtClick = reloads;
try {
  await page.waitForFunction(() => /B-Rep|unavailable/.test(
    document.querySelector(".solid-state")?.textContent ?? ""), null, { timeout: 180000 });
  console.log("FIRST click result:", (await page.locator(".solid-state").textContent()).trim());
} catch { console.log("FIRST click: STILL STUCK"); }
console.log("navigations caused by the click:", reloads - navsAtClick);
console.log("engine still selected:", await page.evaluate(() =>
  [...document.querySelectorAll(".chip-group button")].filter((b) => /Analytic|OpenCASCADE/.test(b.textContent))
    .map((b) => b.textContent + (b.className.includes("on") ? " <ON>" : "")).join(" ")));

// Second visit in the same session must not reload again.
const before = reloads;
await page.goto(url, { waitUntil: "networkidle" });
console.log("revisit navigations:", reloads - before, " isolated:", await page.evaluate(() => window.crossOriginIsolated));
await browser.close();
