// §12 What a mitred box looks like in the 3D view, both engines.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1.5 });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto(process.argv[3] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.getByLabel("Per edge").check();
for (const k of ["front|left", "back|left", "front|right", "back|right"]) {
  await page.getByLabel(`${k} treatment`).selectOption("mitre");
}
await page.getByRole("button", { name: "Material", exact: true }).click();
for (const engine of ["Analytic", "OpenCASCADE"]) {
  await page.getByRole("button", { name: engine, exact: true }).click();
  if (engine === "OpenCASCADE") {
    await page.waitForFunction(() => {
      const el = document.querySelector(".solid-state");
      return el && /B-Rep|unavailable/.test(el.textContent);
    }, null, { timeout: 240000 });
  }
  for (const style of ["Shaded + hidden edges", "Wireframe"]) {
    await page.getByRole("button", { name: style, exact: true }).click();
    await page.waitForTimeout(700);
    await page.locator(".viewport").screenshot({ path: `${out}/mitre3d-${engine}-${style.split(" ")[0]}.png` });
  }
  console.log(engine, await page.locator(".solid-state").textContent().catch(() => "n/a"));
}
await browser.close();
