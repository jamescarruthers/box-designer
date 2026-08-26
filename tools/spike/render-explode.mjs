// §51 The rendered view, exploded and in parallel projection.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

// A driver, so there is something on the box to come apart with it.
await page.getByLabel("Open the Front carcass").click();
await page.waitForTimeout(400);
await page.getByLabel("Add a fitting to the front").selectOption("driver");
await page.waitForTimeout(600);
await page.getByLabel("Close the panel inspector").click();
await page.waitForTimeout(400);

const shot = async (name) => {
  await page.waitForTimeout(1200);
  await page.locator(".pane-render .render-canvas").screenshot({ path: `${out}/${name}.png` });
  console.log(name, "shot");
};
await page.locator(".modes button", { hasText: "Render" }).first().click();
await page.waitForTimeout(3000);
console.log("chips:", await page.evaluate(() =>
  [...document.querySelectorAll(".render-chips button, .render-chips label")].map((b) => b.textContent).join(" | ")));
await shot("r-perspective");
await page.locator("#render-explode").fill("70");
await page.locator("#render-explode").dispatchEvent("input");
await shot("r-exploded");
await page.locator(".render-chips").getByRole("button", { name: "Parallel" }).click();
await shot("r-parallel");
await page.locator("#render-explode").fill("0");
await page.locator("#render-explode").dispatchEvent("input");
await shot("r-parallel-whole");
// And back to the 3D view, which shares the setting.
await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.waitForTimeout(1200);
console.log("3D parallel pressed:", await page.evaluate(() =>
  [...document.querySelectorAll(".pane-view .chips button")].filter((b) => b.textContent === "Parallel")
    .map((b) => b.getAttribute("aria-pressed")).join()));
await page.locator(".pane-view .viewport").screenshot({ path: `${out}/v-parallel.png` });
await browser.close();
