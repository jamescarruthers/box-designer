// §19/§20 The render view's own camera, the sample cap, Stop keeping its
// picture, and a fitting positioned by percentage.
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 200)));
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

// §20 A driver placed by percentage, and what the app says it works out to.
await page.getByLabel("Add a fitting").selectOption("driver");
await page.getByLabel("Fitting 1 units").getByRole("button", { name: "% of panel" }).click();
console.log("as a percentage:", await page.getByLabel("Fitting 1 at x").inputValue(),
  await page.getByLabel("Fitting 1 at z").inputValue());
await page.getByLabel("Fitting 1 at z").fill("25");
await page.getByLabel("Fitting 1 units").getByRole("button", { name: "mm", exact: true }).click();
console.log("back in mm:      ", await page.getByLabel("Fitting 1 at x").inputValue(),
  await page.getByLabel("Fitting 1 at z").inputValue());

// §19 The render view, turned, then left and come back to.
await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(1200);
const box = await page.locator(".render-canvas").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let k = 1; k <= 10; k++) await page.mouse.move(cx + 24 * k, cy - 4 * k);
await page.mouse.up();
await page.waitForTimeout(600);
await page.locator(".render-mode").screenshot({ path: `${out}/kept-before.png` });

await page.getByRole("button", { name: "3D view", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(1200);
await page.locator(".render-mode").screenshot({ path: `${out}/kept-after.png` });

// §19 A small cap, so it finishes; then Stop keeps what it drew.
await page.getByLabel("Samples").fill("6");
await page.getByRole("button", { name: "Refine" }).click();
for (let i = 0; i < 20; i++) {
  const s = await page.locator(".render-state").innerText();
  if (/done|showing the studio/.test(s)) { console.log("capped:", s); break; }
  await page.waitForTimeout(3000);
}
await page.locator(".render-mode").screenshot({ path: `${out}/capped.png` });
console.log("state now:", await page.locator(".render-state").innerText());

// Turning the view is what lets it go.
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 90, cy);
await page.mouse.up();
await page.waitForTimeout(800);
console.log("after turning:", await page.locator(".render-state").innerText());
await page.locator(".render-mode").screenshot({ path: `${out}/released.png` });
await browser.close();
