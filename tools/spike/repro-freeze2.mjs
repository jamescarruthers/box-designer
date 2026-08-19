import { chromium } from "playwright-core";
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

// A: what the user sees — click, reload, then click again.
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
await page.waitForTimeout(6000);
console.log("A after reload: isolated =", await page.evaluate(() => window.crossOriginIsolated));
console.log("A which engine is selected now:",
  await page.evaluate(() => [...document.querySelectorAll(".chip-group button")]
    .filter((b) => /Analytic|OpenCASCADE/.test(b.textContent))
    .map((b) => b.textContent + (b.className.includes("on") ? " <ON>" : "")).join(" ")));
await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
try {
  await page.waitForFunction(() => /B-Rep|unavailable/.test(
    document.querySelector(".solid-state")?.textContent ?? ""), null, { timeout: 120000 });
  console.log("A second click:", (await page.locator(".solid-state").textContent()).trim());
} catch { console.log("A second click: STILL STUCK"); }
await page.close();

// B: service worker unavailable, so isolation can never happen.
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: "block" });
const p2 = await ctx.newPage();
p2.on("pageerror", (e) => console.log("  B [pageerror]", String(e).slice(0, 160)));
p2.on("console", (m) => { if (m.type() === "error") console.log("  B [error]", m.text().slice(0, 160)); });
await p2.goto(url, { waitUntil: "networkidle" });
console.log("B isolated:", await p2.evaluate(() => window.crossOriginIsolated),
            " SAB:", await p2.evaluate(() => typeof SharedArrayBuffer !== "undefined"));
await p2.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
await p2.waitForTimeout(15000);
let state = "FROZEN — main thread not responding";
try {
  state = await Promise.race([
    p2.evaluate(() => document.querySelector(".solid-state")?.textContent?.trim() ?? "(no chip)"),
    new Promise((_, r) => setTimeout(() => r(new Error("x")), 4000))]);
} catch { /* frozen */ }
console.log("B after 15s:", state);
await browser.close();
