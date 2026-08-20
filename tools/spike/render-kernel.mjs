// §19 The rendered view over the kernel's own solids — holes, tube and all —
// and a path trace left running long enough to settle.
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 760, height: 560 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 200)));
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const sheetField = page.locator("label.field").filter({ has: page.getByText("Sheet", { exact: true }) });
await sheetField.locator("select").selectOption("valchromat");
await page.getByLabel("Sheet colour name").selectOption("#da646c");
await page.getByLabel("Add a fitting").selectOption("driver");
await page.getByLabel("Add a fitting").selectOption("port");

await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
await page.waitForFunction(() => {
  const el = document.querySelector(".solid-state");
  return el && /B-Rep|unavailable|showing/.test(el.textContent);
}, null, { timeout: 300000 });
console.log("kernel:", (await page.locator(".solid-state").innerText()).replace(/\s+/g, " "));

await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(2000);
await page.locator(".render-mode").screenshot({ path: `${out}/render-kernel-studio.png` });

await page.getByRole("button", { name: "Refine" }).click();
const t0 = Date.now();
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(4000);
  const s = await page.locator(".render-state").innerText();
  const n = Number(s.match(/, (\d+) samples?/)?.[1] ?? 0);
  if (i % 3 === 0 || n >= 40) console.log(`  ${Math.round((Date.now() - t0) / 1000)}s ${s}`);
  if (n >= 40 || /showing the studio/.test(s)) break;
}
await page.locator(".render-mode").screenshot({ path: `${out}/render-kernel-traced.png` });
await browser.close();
