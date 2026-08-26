// §47 The split: the sidebar is the box, the inspector is one board. Shot side
// by side, with a rebate and a doubler set from the panel itself.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);

console.log("sidebar groups:", await page.evaluate(() =>
  [...document.querySelectorAll(".controls .group > h2, .controls .group > .group-head")]
    .map((h) => h.textContent.trim()).join(" | ")));

await page.getByLabel("Open the Top carcass").click();
await page.waitForTimeout(500);
console.log("inspector groups:", await page.evaluate(() =>
  [...document.querySelectorAll(".inspector .group h2, .inspector .group .group-head")]
    .map((h) => h.textContent.trim()).join(" | ")));

// A doubler, added from the panel it goes on, then rebated from its own panel.
await page.getByRole("button", { name: "Add doubler", exact: true }).click();
await page.waitForTimeout(400);
await page.getByLabel("Open the Top doubler").click();
await page.waitForTimeout(400);
await page.getByLabel("Top doubler rebate all sides").click();
await page.waitForTimeout(900);
console.log("rebate note:", await page.locator(".inspector .rebate .note").first().textContent());
console.log("summary:", await page.evaluate(() =>
  [...document.querySelectorAll(".panel-summary > div")].map((d) => d.textContent).join(" · ")));

await page.locator(".inspector").screenshot({ path: `${out}/inspector-panel.png` });
await page.locator(".side").screenshot({ path: `${out}/inspector-sidebar.png` });
await page.screenshot({ path: `${out}/inspector-whole.png` });
await browser.close();
