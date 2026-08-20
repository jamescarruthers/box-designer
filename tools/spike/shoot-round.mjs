// §16 The rounding option, and what it does to the cut list.
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1.5 });
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Cut list & sheets" }).click();

const shot = async (step, name) => {
  await page.getByLabel("Round sizes to").selectOption(String(step));
  const dims = await page.locator("table.cuts tbody tr").first().innerText();
  console.log(`${String(step).padStart(4)} mm →`, dims.replace(/\s+/g, " "),
    "|", (await page.locator(".readout").innerText()).replace(/\s+/g, " "));
  await page.locator(".controls .group").first().screenshot({ path: `${out}/round-${name}-controls.png` });
  await page.locator("table.cuts").screenshot({ path: `${out}/round-${name}-cuts.png` });
};
await shot(1, "1mm");
await shot(0.1, "tenth");
await browser.close();
