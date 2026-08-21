// Reproduce the sweep's failure in one page and print the exact design that was
// on screen when it failed — the sweep reused a page and a fresh one never
// fails, so what differs is carried across the reload, not in the radius.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const key = await page.evaluate(() => Object.keys(localStorage).find((k) => /box|design/i.test(k)));

const settle = async (ms = 45000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) return "ok";
    if (/ring-stack|Try again/.test(n)) return "FAIL " + n.split("—")[0].trim();
    await page.waitForTimeout(150);
  }
  return "STUCK";
};

async function step(label, patch) {
  await page.evaluate(({ k, p }) => {
    const base = JSON.parse(localStorage.getItem(k) ?? "{}");
    localStorage.setItem(k, JSON.stringify({ ...base, ...p }));
  }, { k: key, p: patch });
  await page.reload({ waitUntil: "domcontentloaded" });
  const r = await settle();
  console.log(label.padEnd(24), r);
  if (r.startsWith("FAIL")) {
    const design = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    console.log("  design that failed:");
    console.log("    thickness      ", design.thickness, "perFace", design.perFaceThickness, JSON.stringify(design.thicknessBy));
    console.log("    edge           ", JSON.stringify(design.edge));
    console.log("    start          ", JSON.stringify(design.start));
    console.log("    round          ", design.round);
    console.log("    fittings       ", (design.fittings ?? []).length);
    console.log("    cladding/doubler", JSON.stringify(design.cladding), JSON.stringify(design.doubler));
    const msgs = await page.locator(".messages").innerText().catch(() => "");
    if (msgs) console.log("    messages       ", msgs.replace(/\n/g, " | ").slice(0, 300));
  }
  return r;
}

const edge = (type, radius) => ({ edge: { type, radius, perEdge: false, by: {} } });
await step("fillet 12", edge("fillet", 12));
await step("fillet 30", edge("fillet", 30));
await step("fillet 30 again", edge("fillet", 30));
await step("back to fillet 12", edge("fillet", 12));
await step("fillet 30 once more", edge("fillet", 30));
await browser.close();
