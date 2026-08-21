// "OpenCASCADE has stopped working again." Open the app the way somebody would
// and report everything the page says about the kernel, plus every console
// message and failed request along the way.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [], failed = [], logs = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on("requestfailed", (r) => failed.push(`${r.url().split("/").pop()} — ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.url().split("/").pop()} — HTTP ${r.status()}`);
});

await page.goto(app, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.evaluate(() => localStorage.clear()).catch(() => {});
await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });

let last = "";
const t0 = Date.now();
for (let i = 0; i < 400; i++) {
  const note = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
  if (note !== last && note) { console.log(`${String(Date.now() - t0).padStart(6)} ms  ${note.split("\n")[0]}`); last = note; }
  if (/B-Rep/.test(note)) break;
  await page.waitForTimeout(300);
}

const state = await page.evaluate(() => ({
  isolated: self.crossOriginIsolated,
  sab: typeof SharedArrayBuffer !== "undefined",
  sw: navigator.serviceWorker ? navigator.serviceWorker.controller ? "controlling" : "registered-or-none" : "unsupported",
  engine: [...document.querySelectorAll(".pane-view .chip-group button")]
    .filter((b) => /Analytic|OpenCASCADE/.test(b.textContent))
    .map((b) => `${b.textContent}${b.className.includes("on") ? "*" : ""}`).join(" "),
  note: document.querySelector(".solid-state")?.textContent ?? "(none)",
  messages: document.querySelector(".messages")?.textContent?.slice(0, 200) ?? "",
}));
console.log("\ncrossOriginIsolated:", state.isolated, "| SharedArrayBuffer:", state.sab, "| service worker:", state.sw);
console.log("engine chips     :", state.engine);
console.log("kernel note      :", state.note);
if (state.messages) console.log("messages         :", state.messages);
if (errors.length) console.log("page errors      :\n  " + errors.join("\n  "));
if (failed.length) console.log("failed requests  :\n  " + [...new Set(failed)].join("\n  "));
if (logs.length) console.log("console          :\n  " + [...new Set(logs)].slice(0, 12).join("\n  "));
await page.screenshot({ path: `${out}/doctor.png` });
await browser.close();
