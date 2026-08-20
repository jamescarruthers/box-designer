// §19 The rendered view: the studio, then the path trace.
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 860 }, deviceScaleFactor: 1.5 });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console]", m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 300)));
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

// A box worth photographing: Valchromat, a colour, a driver and a port.
const sheetField = page.locator("label.field").filter({ has: page.getByText("Sheet", { exact: true }) });
await sheetField.locator("select").selectOption("valchromat");
await page.getByLabel("Sheet colour name").selectOption("#597ba2");   // Blue
await page.getByLabel("Add a fitting").selectOption("driver");
await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("12");

await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(2500);
console.log("state:", await page.locator(".render-state").innerText());
await page.locator(".render-mode").screenshot({ path: `${out}/render-studio.png` });

// And the path trace.
await page.getByRole("button", { name: "Refine" }).click();
const t0 = Date.now();
for (let i = 0; i < 30; i++) {
  const s = await page.locator(".render-state").innerText();
  if (/failed|not available|showing the studio/.test(s)) { console.log("trace:", s); break; }
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s ${s}`);
  if (/samples/.test(s) && Number(s.match(/(\d+) samples?/)?.[1] ?? 0) >= 6) { console.log("trace:", s, `after ${Math.round((Date.now()-t0)/1000)} s`); break; }
  await page.waitForTimeout(2000);
}
await page.locator(".render-mode").screenshot({ path: `${out}/render-traced.png` });
await browser.close();
