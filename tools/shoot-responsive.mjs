import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [w, h, tag] of [[1280, 860, "1280"], [960, 900, "960"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Cut list & sheets", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/resp-${tag}.png`, fullPage: tag === "960" });
  await page.close();
}
await browser.close();
