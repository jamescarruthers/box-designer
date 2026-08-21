// §23 The same cold open, against the deployed site — which serves the kernel
// gzipped, where `vite preview` sends it whole.
import { chromium } from "playwright-core";
const URL = "https://jamescarruthers.github.io/box-designer/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open({ label, down, latency }) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 880 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  let wasmBytes = 0, wasmEncoded = 0;
  page.on("response", async (r) => {
    if (!r.url().endsWith(".wasm")) return;
    wasmEncoded = Number(r.headers()["content-length"] ?? 0);
  });
  if (down) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency, downloadThroughput: down, uploadThroughput: down,
    });
  }
  const t0 = Date.now();
  await page.goto(URL, { timeout: 180000 });
  await page.waitForSelector(".pane-view canvas", { timeout: 180000 });
  const firstBox = Date.now() - t0;
  let ready = null, note = "";
  for (let i = 0; i < 480; i++) {
    note = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(note)) { ready = Date.now() - t0; break; }
    if (/unavailable|would not/.test(note)) { note = "FAILED " + note; break; }
    await page.waitForTimeout(250);
  }
  console.log(`${label.padEnd(10)} box ${String(firstBox).padStart(6)} ms · kernel ${ready ? String(ready).padStart(6) + " ms" : "   n/a"} · wasm ${(wasmEncoded/1048576).toFixed(2)} MB · ${note.split("\n")[0]}`);
  await context.close();
}

await open({ label: "unthrottled" });
await open({ label: "4G", down: 1.5 * 1024 * 1024 / 8, latency: 60 });
await open({ label: "slow 3G", down: 400 * 1024 / 8, latency: 300 });
await browser.close();
