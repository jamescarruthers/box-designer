// Switch the 3D view onto the kernel solids and screenshot both engines.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });

await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("12");
await page.getByRole("button", { name: "Shaded", exact: true }).click();
await page.waitForTimeout(600);
await page.locator(".pane-view").screenshot({ path: `${out}/3d-analytic.png` });

await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
await page.waitForFunction(() => {
  const el = document.querySelector(".solid-state");
  return el && /B-Rep|unavailable/.test(el.textContent);
}, null, { timeout: 240000 });
console.log("solid state:", (await page.locator(".solid-state").textContent()).trim());
await page.waitForTimeout(500);
await page.locator(".pane-view").screenshot({ path: `${out}/3d-kernel.png` });
console.log(errs.length ? "ERRORS:\n" + errs.slice(0, 4).join("\n") : "no page errors");
await browser.close();
