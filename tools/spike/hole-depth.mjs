// §33 Bolts into the baffle, cutout on through the doubler: what the kernel
// cuts, panel by panel, and what the templates say.
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
const notes = async () => {
  await page.locator(".modes button", { hasText: "Cut list" }).first().click();
  await page.waitForTimeout(600);
  const all = await page.locator("figcaption").allInnerTexts();
  return all.filter((t) => /Driver/.test(t)).map((t) => t.replace(/\s+/g, " ").trim());
};

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

await page.locator(".controls").getByLabel("Add doublers", { exact: true }).selectOption("front");
await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
console.log("all the way through:", await settle());
for (const n of await notes()) console.log("  ", n);

await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.locator(".controls").getByLabel("Fitting 1 boltsThrough", { exact: true }).selectOption("1");
console.log("bolts to the baffle :", await settle());
for (const n of await notes()) console.log("  ", n);

// Look at it: drivers off, exploded, from behind.
await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.locator(".pane-view").getByRole("button", { name: "Drivers", exact: true }).click();
await page.locator(".pane-view").getByRole("button", { name: "Shaded", exact: true }).click();
await page.locator("#explode").fill("80");
const box = await page.locator(".pane-view .viewport").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 430, box.y + box.height / 2 + 40, { steps: 24 });
await page.mouse.up();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/hole-depth.png` });
await browser.close();
