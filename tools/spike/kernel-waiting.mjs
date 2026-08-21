// §23 What is on screen during the wait, now that every visitor has one.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const context = await browser.newContext({ viewport: { width: 1400, height: 880 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 60, downloadThroughput: 1.5 * 1024 * 1024 / 8, uploadThroughput: 1.5 * 1024 * 1024 / 8,
});
await page.goto("http://localhost:5012/");
await page.waitForSelector(".pane-view canvas");
for (const at of [2000, 6000, 12000]) {
  await page.waitForTimeout(at === 2000 ? 2000 : 4000);
  const note = await page.locator(".solid-state").innerText().catch(() => "(none)");
  const drawn = await page.evaluate(() => !!document.querySelector(".pane-view canvas")?.width);
  console.log(`${String(at).padStart(6)} ms — box drawn: ${drawn} — "${note.split("\n")[0]}"`);
}
await page.screenshot({ path: `${out}/waiting-4g.png` });
await browser.close();
