import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("console", (m) => console.log(`[${m.type()}]`, m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 400)));
page.on("requestfailed", (r) => console.log("[failed]", r.url().slice(-60), r.failure()?.errorText));
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Drawing", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
await page.waitForTimeout(60000);
console.log("state:", (await page.locator(".engine-state").textContent()).trim());
await browser.close();
