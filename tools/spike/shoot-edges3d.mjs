// Reproduce: with a fillet, does the edge overlay show where the flat face ends?
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1.5 });
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("14");
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
    await page.locator(".viewport").screenshot({ path: `${out}/edges-${engine}-${style.split(" ")[0]}.png` });
  }
}
console.log("done");
await browser.close();
