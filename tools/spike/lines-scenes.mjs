// §17 The fat lines under everything that draws lines: fillets, the kernel's
// own B-Rep edges, a port tube, an exploded box, a selection, and the pick
// highlight. And what a frame costs now that every line is a quad.
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5011";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console]", m.text()); });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
const view = () => page.locator(".viewport");

// A box with something to look at: fillets, a driver and a port.
await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("14");
await page.getByLabel("Add a fitting").selectOption("driver");
await page.getByLabel("Add a fitting").selectOption("port");
await page.waitForTimeout(600);
await view().screenshot({ path: `${out}/scene-analytic.png` });

// Exploded, so panels leave the middle and the far plane has to follow.
await page.locator("#explode").fill("90");
await page.waitForTimeout(500);
await view().screenshot({ path: `${out}/scene-exploded.png` });
await page.locator("#explode").fill("0");

// The kernel's own edges, including the tube's.
await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
await page.waitForFunction(() => {
  const el = document.querySelector(".solid-state");
  return el && /B-Rep|unavailable|showing/.test(el.textContent);
}, null, { timeout: 300000 });
console.log("kernel:", (await page.locator(".solid-state").innerText()).replace(/\s+/g, " "));
await page.waitForTimeout(500);
await view().screenshot({ path: `${out}/scene-kernel.png` });

// A frame, timed, while the box is turning.
const box = await view().boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
const t0 = Date.now();
for (let i = 0; i < 60; i++) await page.mouse.move(cx + i * 2, cy + Math.sin(i / 6) * 30);
await page.mouse.up();
console.log(`60 orbit steps in ${Date.now() - t0} ms`);

await page.getByRole("button", { name: "Analytic", exact: true }).click();
await view().screenshot({ path: `${out}/scene-turned.png` });
await browser.close();
