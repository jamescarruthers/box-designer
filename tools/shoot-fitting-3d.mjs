// A driver and a port, in the kernel 3D view.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });

await page.getByLabel("Add a fitting").selectOption("driver");
await page.getByLabel("Add a fitting").selectOption("port");
await page.getByLabel("Fitting 1 at z").fill("230");
await page.getByLabel("Fitting 2 at z").fill("70");
await page.getByRole("button", { name: "Shaded", exact: true }).click();
await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
await page.waitForFunction(() => {
  const el = document.querySelector(".solid-state");
  return el && /B-Rep|unavailable/.test(el.textContent);
}, null, { timeout: 240000 });
console.log("solid state:", (await page.locator(".solid-state").textContent()).trim());
await page.getByRole("button", { name: "front", exact: true }).click();
await page.waitForTimeout(800);
await page.locator(".pane-view").screenshot({ path: `${out}/fit-3d-front.png` });
await page.getByRole("button", { name: "iso", exact: true }).click();
await page.locator("#explode").fill("40");
await page.waitForTimeout(800);
await page.locator(".pane-view").screenshot({ path: `${out}/fit-3d-iso.png` });
console.log(errs.length ? "ERRORS:\n" + errs.slice(0, 3).join("\n") : "no page errors");
await browser.close();
