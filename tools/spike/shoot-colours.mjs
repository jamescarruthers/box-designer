// §18 Colours, in the app: the sheet's own, one per panel, and where they land.
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1.5 });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const sheetField = page.locator("label.field").filter({ has: page.getByText("Sheet", { exact: true }) });
await sheetField.locator("select").selectOption("valchromat");
console.log("names:", await page.getByLabel("Sheet colour name").locator("option").allInnerTexts());

await page.getByLabel("Sheet colour name").selectOption("#548772");     // Green Mint
await page.getByRole("button", { name: "Material", exact: true }).click();
await page.waitForTimeout(400);
await page.locator(".viewport").screenshot({ path: `${out}/colour-sheet.png` });

await page.getByLabel("Colour per panel").check();
await page.getByLabel("Front colour name").selectOption("#da646c");     // Red
await page.getByLabel("Top colour name").selectOption("#e3b869");       // Yellow
await page.waitForTimeout(400);
await page.locator(".viewport").screenshot({ path: `${out}/colour-panels.png` });
await page.locator(".controls .group").filter({ hasText: "MATERIAL" }).first().screenshot({ path: `${out}/colour-controls.png` });

await page.getByRole("button", { name: "Cut list & sheets" }).click();
await page.waitForTimeout(300);
await page.locator("table.cuts").screenshot({ path: `${out}/colour-cuts.png` });
await browser.close();
