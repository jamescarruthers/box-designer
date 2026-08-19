// Reproduce the user's report: no COOP/COEP from the server, as GitHub Pages.
import { chromium } from "playwright-core";
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on("console", (m) => console.log(`  [${m.type()}] ${m.text().slice(0, 160)}`));
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));
page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("  [navigated]", f.url().slice(-30)); });

await page.goto(url, { waitUntil: "networkidle" });
console.log("isolated at first load:", await page.evaluate(() => window.crossOriginIsolated));

await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
console.log("clicked OpenCASCADE");

// Is the main thread still answering after 20 s?
for (const t of [5000, 10000, 20000]) {
  await page.waitForTimeout(t === 5000 ? 5000 : 5000);
  let alive = "FROZEN (main thread not responding)";
  try {
    alive = await Promise.race([
      page.evaluate(() => document.querySelector(".solid-state")?.textContent?.trim() ?? "(no chip)"),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
  } catch { /* frozen */ }
  console.log(`  t+${t / 1000}s  isolated=${await page.evaluate(() => window.crossOriginIsolated).catch(() => "?")}  chip="${alive}"`);
}
await browser.close();
