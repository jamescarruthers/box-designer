// §36 The two new things, in the app: a flare that opens out through the bolt
// holes (allowed, warned about), and bolt holes drilled to a depth.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
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
const warnings = async () => (await page.locator(".messages p.warning").allInnerTexts())
  .map((t) => t.replace(/\s+/g, " ")).filter((t) => /bolt holes at|flare/.test(t));

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

await field("Add doublers").selectOption("front");
await field("Add a fitting").selectOption("driver");
await page.locator(".controls .fitting-flare").getByRole("button", { name: "Fillet" }).click();
console.log("bolt deep offered:", await field("Fitting 1 boltDeep").inputValue(), "mm");

// A flare well past the bolt circle — the shape §29 would not cut at all.
await field("Fitting 1 flare").fill("18"); await field("Fitting 1 flare").blur();
await page.waitForTimeout(400);
console.log("R18 flare        :", await settle());
console.log("  control note   :", await page.locator(".controls .flare-note").innerText());
for (const w of await warnings()) console.log("  warning        :", w.slice(w.indexOf("the R")));

// Blind bolt holes: 12 mm into an 18 mm baffle, nothing behind it.
await field("Fitting 1 boltDeep").fill("12"); await field("Fitting 1 boltDeep").blur();
await page.waitForTimeout(400);
console.log("12 mm bolt holes :", await settle());

await page.locator(".pane-view").getByRole("button", { name: "Drivers", exact: true }).click();
await page.locator(".pane-view").getByRole("button", { name: "Shaded", exact: true }).click();
await page.locator("#explode").fill("80");
const box = await page.locator(".pane-view .viewport").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 430, box.y + box.height / 2 + 40, { steps: 24 });
await page.mouse.up();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/bolt-depth.png` });
await browser.close();
