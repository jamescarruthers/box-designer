// §31 The rest of the datasheet's dimensions: what the fields start at, and
// what the drawn driver does when they are given real numbers.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const field = (label) => page.locator(".controls").getByLabel(label, { exact: true });
const set = async (label, v) => { const f = field(label); await f.fill(String(v)); await f.blur(); };
const settle = async (ms = 90000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) return n.replace(/\n/g, " ");
    if (/Try again/.test(n)) return `FAILED: ${n.replace(/\n/g, " ")}`;
    await page.waitForTimeout(150);
  }
  return "STUCK";
};

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await settle();
const dims = ["thick", "basket", "vc", "cutout", "outer", "depth", "magnet", "magnetDepth", "coneDepth", "displaces"];
const read = async () => Object.fromEntries(await Promise.all(
  dims.map(async (d) => [d, await field(`Fitting 1 ${d}`).inputValue()])));
console.log("as offered:", JSON.stringify(await read()));
await page.locator(".pane-view").getByRole("button", { name: "front", exact: true }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/dims-guessed.png` });

// A 15 inch pro woofer: a thick cast frame, a big coil, a basket cut to suit.
for (const [label, v] of [["cutout", 350], ["outer", 390], ["pcd", 370], ["depth", 180],
  ["magnet", 160], ["magnetDepth", 70], ["coneDepth", 95], ["thick", 12], ["basket", 344], ["vc", 100]]) {
  await set(`Fitting 1 ${label}`, v);
}
await page.waitForTimeout(400);
console.log("as given  :", JSON.stringify(await read()));
console.log("kernel    :", await settle());
console.log("note      :", await page.locator(".controls .fitting .note").innerText());
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/dims-given.png` });

// And a basket the hole will not take.
await set("Fitting 1 basket", 360);
await page.waitForTimeout(500);
const msgs = await page.locator(".messages p").allInnerTexts().catch(() => []);
console.log("too big   :", msgs.find((t) => /basket/.test(t))?.replace(/\s+/g, " ") ?? "(no message found)");
await browser.close();
