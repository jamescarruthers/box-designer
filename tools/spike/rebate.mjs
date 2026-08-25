// §42 A front panel let into the sides: the control, the 3D view, the section
// and the isometric.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
const field = (l) => page.locator(".controls").getByLabel(l, { exact: true });
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

// The front panel has to be inset for there to be anything to rebate into,
// which is how a let-in baffle is built anyway.
await page.locator("label.field").filter({ has: page.getByText("Preset", { exact: true }) })
  .locator("select").selectOption("sides");
await page.waitForTimeout(500);
await field("Add a rebate").selectOption("front");
await page.waitForTimeout(400);
await field("Front rebate all sides").click();
await field("Front rebate depth").fill("6");
await page.waitForTimeout(900);

console.log("cut:", await page.locator(".rebate .note").innerText());
const messages = await page.locator(".messages").innerText().catch(() => "");
if (messages) console.log("messages:", messages.replace(/\n/g, " | ").slice(0, 400));
await page.locator(".controls").screenshot({ path: `${out}/rebate-controls.png` });

await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1400);
await page.locator(".sheet-holder").screenshot({ path: `${out}/rebate-sheet.png` });

// The cut list: the baffle is bigger, the panels beside it carry a note.
await page.locator(".modes button", { hasText: "Cut list" }).first().click();
await page.waitForTimeout(900);
console.log("notes:", await page.evaluate(() =>
  [...document.querySelectorAll("figcaption")].map((f) => f.textContent.trim())
    .filter((t) => /Rebate/.test(t)).join(" | ")));
console.log("sizes:", await page.evaluate(() =>
  [...document.querySelectorAll("table.cuts tbody tr")].slice(0, 6)
    .map((r) => [...r.children].slice(0, 4).map((c) => c.textContent.trim()).join(" ")).join(" | ")));

// And the 3D view, exploded enough to see the tongue and the groove.
await page.locator(".modes button", { hasText: "3D view" }).first().click();
await page.waitForTimeout(1500);
await page.locator("#explode").fill("70");
await page.waitForTimeout(1200);
await page.locator(".viewport").screenshot({ path: `${out}/rebate-3d.png` });
await browser.close();
