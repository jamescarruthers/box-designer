// §19 Just the path trace, quickly: is what it draws the same scene the studio
// render draws?
import { chromium } from "playwright-core";
const out = process.argv[3] ?? ".";
const tag = process.argv[4] ?? "trace";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 700, height: 500 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 200)));
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Refine" }).click();
const samples = async () => Number((await page.locator(".render-state").innerText()).match(/, (\d+) samples?/)?.[1] ?? 0);
for (let i = 0; i < 15 && (await samples()) < 6; i++) await page.waitForTimeout(3000);
console.log(tag, "→", await page.locator(".render-state").innerText());
await page.locator(".render-mode").screenshot({ path: `${out}/${tag}.png` });
await browser.close();
