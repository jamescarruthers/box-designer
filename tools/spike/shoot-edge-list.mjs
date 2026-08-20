// §15 The per-edge list, once a few edges have been treated: does it read as a
// list of what has been done, and does each row fit its four columns?
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.getByLabel("Per edge").check();
for (const k of ["front|left", "front|right", "left|top"])
  await page.getByLabel("Add an edge treatment").selectOption(k);
await page.getByLabel("front|right treatment").selectOption("chamfer");
await page.getByLabel("left|top treatment").selectOption("mitre");
await page.getByLabel("front|left radius").fill("18");
await page.getByRole("button", { name: "Mitre an edge" }).click();

const group = page.locator(".group", { hasText: "Edge treatment" });
await group.scrollIntoViewIfNeeded();
await group.screenshot({ path: `${out}/edge-list.png` });
console.log(await page.locator(".edge-row").allInnerTexts());
console.log("messages:", await page.locator(".messages li").allInnerTexts());
await browser.close();
