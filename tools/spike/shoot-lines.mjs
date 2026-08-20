// §4 What the lines in the 3D view actually look like, close up.
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const tag = process.argv[4] ?? "before";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
const box = await page.locator(".viewport canvas").boundingBox();

for (const style of ["Shaded + hidden edges", "Wireframe"]) {
  await page.getByRole("button", { name: style, exact: true }).click();
  await page.waitForTimeout(400);
  const name = style.startsWith("Wire") ? "wire" : "shaded";
  await page.screenshot({ path: `${out}/lines-${tag}-${name}.png`, clip: box });
  // A close crop of one corner, where coincident edges and shading meet.
  await page.screenshot({ path: `${out}/lines-${tag}-${name}-crop.png`,
    clip: { x: box.x + box.width * 0.34, y: box.y + box.height * 0.22, width: 300, height: 220 } });
}
await browser.close();
