// §19 Does the backdrop stay behind the box when the view is turned, and does
// the light keep falling the same way across it?
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 1.5 });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 200)));
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const sheetField = page.locator("label.field").filter({ has: page.getByText("Sheet", { exact: true }) });
await sheetField.locator("select").selectOption("valchromat");
await page.getByLabel("Sheet colour name").selectOption("#548772");   // Green Mint
await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(1500);

const box = await page.locator(".render-canvas").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
for (const [i, drag] of [0, 260, 260, 260].entries()) {
  if (drag) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(cx + (drag * k) / 10, cy);
    await page.mouse.up();
  }
  await page.waitForTimeout(700);
  await page.locator(".render-mode").screenshot({ path: `${out}/turn-${i}.png` });
  console.log(`turned to view ${i}`);
}
// And the path trace, including a turn part-way through it: the studio moves
// with the camera, so the tracer's baked scene has to be refitted or the
// backdrop is left behind where it used to be.
await page.getByRole("button", { name: "Refine" }).click();
const samples = async () => Number((await page.locator(".render-state").innerText()).match(/, (\d+) samples?/)?.[1] ?? 0);
for (let i = 0; i < 12 && (await samples()) < 4; i++) await page.waitForTimeout(4000);
console.log("before the turn:", await page.locator(".render-state").innerText());
await page.locator(".render-mode").screenshot({ path: `${out}/traced-before.png` });

await page.mouse.move(cx, cy);
await page.mouse.down();
for (let k = 1; k <= 10; k++) await page.mouse.move(cx + 30 * k, cy);
await page.mouse.up();
for (let i = 0; i < 12 && (await samples()) < 4; i++) await page.waitForTimeout(4000);
console.log("after the turn: ", await page.locator(".render-state").innerText());
await page.locator(".render-mode").screenshot({ path: `${out}/traced-after.png` });

await browser.close();
