// §23 Opening the app cold with the kernel as the default engine: what is on
// screen, when, and what the wait costs.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open({ label, throttle }) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 880 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  if (throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: throttle.latency,
      downloadThroughput: throttle.down, uploadThroughput: throttle.down,
    });
  }
  const t0 = Date.now();
  await page.goto(process.env.APP ?? "http://localhost:5011/");
  // The box is on screen as soon as the analytic stacks are drawn.
  await page.waitForSelector(".pane-view canvas", { timeout: 60000 });
  const firstBox = Date.now() - t0;
  let ready = null, note = "";
  for (let i = 0; i < 600; i++) {
    note = await page.locator(".solid-state").innerText().catch(() => "");
    if (/B-Rep/.test(note)) { ready = Date.now() - t0; break; }
    if (/unavailable|showing the ring-stack/.test(note)) { note = "FAILED: " + note; break; }
    await page.waitForTimeout(250);
  }
  console.log(`${label.padEnd(14)} box drawn ${String(firstBox).padStart(5)} ms · kernel ${ready ? String(ready).padStart(5) + " ms" : "  n/a"} · ${note.split("\n")[0]}`);
  await page.screenshot({ path: `${out}/default-${label.replace(/\W+/g, "-")}.png` });
  await context.close();
  return { firstBox, ready };
}

await open({ label: "unthrottled" });
// Where the kernel actually costs something. 4G is about 1.5 Mbit down; slow 3G
// is the floor a phone on a bad signal falls to.
await open({ label: "4g", throttle: { down: 1.5 * 1024 * 1024 / 8, latency: 60 } });
await open({ label: "slow-3g", throttle: { down: 400 * 1024 / 8, latency: 300 } });
await browser.close();
