// §29 The flare, in the app: switch it on, and look at the back of the baffle.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const solidState = () => page.locator(".solid-state").innerText().catch(() => "");
const settle = async (ms = 90000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = await solidState();
    if (/B-Rep/.test(n)) return n.replace(/\n/g, " ");
    if (/Try again/.test(n)) return `FAILED: ${n.replace(/\n/g, " ")}`;
    await page.waitForTimeout(150);
  }
  return "STUCK";
};

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
console.log("square cutout   :", await settle());
console.log("note            :", await page.locator(".controls .fitting .note").innerText());

const flare = page.locator(".controls .fitting-flare");
await flare.getByRole("button", { name: "Fillet" }).click();
console.log("radius offered  :", await page.locator(".controls").getByLabel("Fitting 1 flare", { exact: true }).inputValue(), "mm");
console.log("filleted cutout :", await settle());
console.log("note            :", await page.locator(".controls .fitting .note").innerText());

// Look at it from behind, where the flare is.
await page.getByRole("button", { name: "back", exact: true }).click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/flare-back.png` });

await flare.getByRole("button", { name: "Chamfer" }).click();
console.log("chamfered cutout:", await settle());
console.log("note            :", await page.locator(".controls .fitting .note").innerText());
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/flare-chamfer.png` });
await browser.close();
