// §15 Does clicking an edge in the 3D view actually apply the treatment?
// jsdom can assert the wiring but not the ray, so this arms a tool, moves the
// pointer over a real edge, checks the hint appears, clicks, and reads the list.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, deviceScaleFactor: 1.5 });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
// Cleared once, not on every navigation: the reload at the end is checking
// that the design survives one, and an init script would clear it first.
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByLabel("Per edge").check();

const rows = () => page.locator(".edge-row").count();
console.log("rows before:", await rows());

await page.getByRole("button", { name: "Fillet an edge" }).click();
const box = await page.locator(".viewport canvas").boundingBox();

// Sweep the canvas for a point the pick layer answers to, then click it.
let hit = null;
for (let dy = 0.15; dy < 0.9 && !hit; dy += 0.02) {
  for (let dx = 0.15; dx < 0.9; dx += 0.02) {
    const x = box.x + box.width * dx, y = box.y + box.height * dy;
    await page.mouse.move(x, y);
    // The viewport puts the pointer cursor on when a click would land on an
    // edge, so the DOM says where the targets are without the page telling it.
    const hot = await page.locator(".viewport").evaluate((el) => el.style.cursor === "pointer");
    if (hot) { hit = { x, y, dx, dy }; break; }
  }
}
console.log("hover found at:", hit && [hit.dx.toFixed(2), hit.dy.toFixed(2)].join(","));
await page.locator(".viewport").screenshot({ path: `${out}/edgepick-hover.png` });

await page.mouse.click(hit.x, hit.y);
await page.waitForTimeout(400);
console.log("rows after:", await rows());
console.log("list:", await page.locator(".edge-row .edge-key").allInnerTexts());
console.log("select:", await page.locator(".edge-row select").first().inputValue());
await page.locator(".viewport").screenshot({ path: `${out}/edgepick-applied.png` });

// And it survives a reload, since the design is stored.
await page.reload({ waitUntil: "networkidle" });
console.log("rows after reload:", await rows());
await browser.close();
