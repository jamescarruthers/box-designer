// §26 The guard, in the real app: the control will not take a radius past the
// wall, and a design that arrives carrying one is drawn square rather than sent
// to the kernel to be refused.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

const settle = async (page, ms = 45000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) return "ok  " + n.split("\n")[0];
    if (/ring-stack|Try again/.test(n)) return "FAIL " + n.split("—")[0].trim();
    await page.waitForTimeout(150);
  }
  return "STUCK";
};

// 1. Typing a radius past the wall.
{
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  await page.locator(".controls").getByRole("button", { name: "Fillet", exact: true }).click();
  const radius = page.getByLabel("Radius", { exact: true });
  await radius.fill("40"); await radius.blur();
  await page.waitForTimeout(400);
  console.log("typed 40 on an 18 mm wall ->", await radius.inputValue(), "|", await settle(page));
  console.log("  note:", (await page.locator(".controls .note").filter({ hasText: "thinnest wall" }).innerText().catch(() => "(none)")));
  await page.close();
}

// 2. A design that already holds one.
{
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("sheet-box-designer/design/1",
    JSON.stringify({ edge: { type: "fillet", radius: 40, perEdge: false, by: {} } })));
  await page.reload({ waitUntil: "domcontentloaded" });
  console.log("design carrying R40      ->", await settle(page));
  const msg = await page.locator(".messages").innerText().catch(() => "(none)");
  console.log("  says:", msg.split("\n")[0].slice(0, 90));
  await page.close();
}
await browser.close();
