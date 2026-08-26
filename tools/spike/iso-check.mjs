// Look at the drawing's isometric in a handful of configurations.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
const drawing = async (name) => {
  await page.locator(".modes button", { hasText: "Drawing" }).first().click();
  await page.waitForTimeout(1400);
  const svg = await page.locator(".sheet-holder svg").first();
  await svg.screenshot({ path: `${out}/${name}.png` });
  console.log(name, "shot");
};
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);

// 1. mitred ring
await page.locator(".controls").getByText("Per edge").click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Mitre a ring of/ }).click();
await page.waitForTimeout(800);
await drawing("iso-mitred");

// 2. plus a doubler and lagging
await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.getByLabel("Open the Front carcass").click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Add doubler", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Add lagging", exact: true }).click();
await page.waitForTimeout(800);
await drawing("iso-layers");

// 3. plus a rebate on the front doubler
await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.getByLabel("Open the Front doubler").click();
await page.waitForTimeout(400);
await page.getByLabel("Front doubler rebate all sides").click();
await page.waitForTimeout(900);
await drawing("iso-rebated");

// 4. exploded
await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.locator("#iso-explode").fill("60");
await page.locator("#iso-explode").dispatchEvent("change");
await page.waitForTimeout(900);
await drawing("iso-exploded");
await browser.close();
