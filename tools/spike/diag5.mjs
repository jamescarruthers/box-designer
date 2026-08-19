import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
page.on("console", (m) => console.log(`[${m.type()}]`, m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
console.log("buttons named OpenCASCADE:", await page.getByRole("button", { name: "OpenCASCADE", exact: true }).count());
await page.getByRole("button", { name: "OpenCASCADE", exact: true }).click();
for (const t of [1000, 5000, 15000, 30000]) {
  await page.waitForTimeout(t === 1000 ? t : t - 1000);
  const el = await page.locator(".solid-state").count();
  console.log(`t=${t}ms  .solid-state count=${el}  text="${el ? (await page.locator(".solid-state").textContent()).trim() : ""}"`);
}
await browser.close();
