// §29 The flare, seen: explode the box, turn the drivers off, and swing the
// camera round behind the baffle where the cut actually is.
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
    if (/Try again/.test(n)) return `FAILED: ${n}`;
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
// The driver would sit in front of the very thing being looked at.
await page.locator(".pane-view").getByRole("button", { name: "Drivers", exact: true }).click();
await page.locator(".pane-view").getByRole("button", { name: "Shaded", exact: true }).click();
const explode = page.locator("#explode");
await explode.fill("70");

// Swing round behind the front panel.
const box = await page.locator(".pane-view .viewport").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx - 430, cy + 40, { steps: 24 });
await page.mouse.up();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/look-square.png` });

const flare = page.locator(".controls .fitting-flare");
await flare.getByRole("button", { name: "Fillet" }).click();
const r = page.locator(".controls").getByLabel("Fitting 1 flare", { exact: true });
await r.fill("12"); await r.blur();
console.log("filleted:", await settle());
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/look-fillet.png` });

await flare.getByRole("button", { name: "Chamfer" }).click();
console.log("chamfered:", await settle());
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/look-chamfer.png` });
await browser.close();
