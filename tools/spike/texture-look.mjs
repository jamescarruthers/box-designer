// §39 The board texture, close up and at arm's length.
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1.5 });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 300)));
await page.goto(process.argv[2] ?? "http://localhost:5012", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const sheetField = page.locator("label.field").filter({ has: page.getByText("Sheet", { exact: true }) });
await sheetField.locator("select").selectOption("valchromat");
await page.getByLabel("Sheet colour name").selectOption("#597ba2");
await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(2500);
await page.locator(".render-mode").screenshot({ path: `${out}/texture-far.png` });

// In close, where the fibre has to hold up.
const box = await page.locator(".render-mode").boundingBox();
for (let i = 0; i < 11; i++) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(1500);
await page.locator(".render-mode").screenshot({ path: `${out}/texture-near.png` });
await browser.close();
