// §34 A full fillet in the app: the whole thickness of the doubler rolled away
// once the bolts stop at the baffle in front of it.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

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
const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
const state = async (what) => console.log(what.padEnd(24),
  "| flare", (await field("Fitting 1 flare").inputValue()).padStart(5),
  "| note:", (await page.locator(".controls .flare-note").innerText()).replace(/\s+/g, " "));

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

await field("Add doublers").selectOption("front");
await field("Add a fitting").selectOption("driver");
await page.locator(".controls .fitting-flare").getByRole("button", { name: "Fillet" }).click();
await settle();

await field("Fitting 1 flare").fill("18");
await field("Fitting 1 flare").blur();
await page.waitForTimeout(400);
await state("bolts all the way");
console.log("  kernel:", await settle());

await field("Fitting 1 boltsThrough").selectOption("1");
await page.waitForTimeout(300);
await field("Fitting 1 flare").fill("18");
await field("Fitting 1 flare").blur();
await page.waitForTimeout(400);
await state("bolts to the baffle");
console.log("  kernel:", await settle());
console.log("  cut list note:", await page.locator(".controls .fitting .note").innerText());

// Look at the back of it.
await page.locator(".pane-view").getByRole("button", { name: "Drivers", exact: true }).click();
await page.locator(".pane-view").getByRole("button", { name: "Shaded", exact: true }).click();
await page.locator("#explode").fill("80");
const box = await page.locator(".pane-view .viewport").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 430, box.y + box.height / 2 + 40, { steps: 24 });
await page.mouse.up();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/full-fillet.png` });
await browser.close();
