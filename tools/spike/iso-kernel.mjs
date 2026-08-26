// The drawing's isometric with the kernel actually loaded, on a box that has
// the new §46 shapes in it: a rebated doubler and a driver.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
// Wait for the kernel to say it is ready.
const ready = async () => {
  for (let i = 0; i < 60; i++) {
    const t = await page.locator(".solid-state").first().textContent().catch(() => "");
    if (/B-Rep/.test(t ?? "")) return t;
    await page.waitForTimeout(500);
  }
  return "never ready";
};
console.log("kernel:", await ready());

// §49 The box as it was reported: mitred corners, a doubler, a lining, and a
// rebate on the doubler.
await page.locator(".controls").getByText("Per edge").click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Mitre a ring of/ }).click();
await page.waitForTimeout(700);
await page.getByLabel("Open the Back carcass").click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Add lagging", exact: true }).click();
await page.waitForTimeout(500);
await page.getByLabel("Open the Top carcass").click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Add doubler", exact: true }).click();
await page.waitForTimeout(600);
await page.getByLabel("Open the Top doubler").click();
await page.waitForTimeout(400);
await page.getByLabel("Top doubler rebate all sides").click();
await page.waitForTimeout(500);
await page.getByLabel("Close the panel inspector").click();
console.log("kernel after rebate:", await ready());

const shot = async (name) => {
  await page.locator(".modes button", { hasText: "Drawing" }).first().click();
  await page.waitForTimeout(2500);
  await page.locator(".sheet-holder svg").first().screenshot({ path: `${out}/${name}.png` });
  console.log(name, "shot");
  await page.locator(".modes button", { hasText: "3D view" }).first().click();
  await page.waitForTimeout(400);
};
await shot("k-rebated-doubler");
await browser.close();
