// §51 The two things a swapped camera could quietly break: picking an edge in
// the 3D view, and the path tracer in the rendered one.
import { chromium } from "playwright-core";
const app = process.env.APP ?? "http://localhost:5012/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

// §15 Arm a treatment and click an edge, in parallel projection.
await page.locator(".pane-view .chips").getByRole("button", { name: "Parallel" }).click();
await page.waitForTimeout(700);
await page.getByLabel("Fillet an edge").click();
await page.waitForTimeout(400);
const box = await page.locator(".pane-view .viewport").boundingBox();
// Walk the top-front edge of the box looking for a hit.
let applied = "none";
for (let i = 0; i <= 24 && applied === "none"; i++) {
  const x = box.x + box.width * (0.38 + i * 0.01);
  const y = box.y + box.height * (0.30 + i * 0.004);
  await page.mouse.click(x, y);
  await page.waitForTimeout(250);
  applied = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".controls .edge-row")];
    return rows.length ? rows.map((r) => r.textContent.slice(0, 24)).join(" / ") : "none";
  });
}
console.log("edge picked in parallel:", applied);

// The path tracer, in parallel projection.
await page.locator(".modes button", { hasText: "Render" }).first().click();
await page.waitForTimeout(2500);
await page.locator(".render-chips").getByRole("button", { name: "Parallel" }).click();
await page.waitForTimeout(1200);
const trace = async (label) => {
  await page.locator(".render-chips").getByRole("button", { name: "Refine" }).click();
  for (const wait of [4000, 8000, 12000]) {
    await page.waitForTimeout(wait === 4000 ? 4000 : 4000);
    console.log(`${label} at ${wait / 1000}s:`, (await page.locator(".render-state").textContent()).trim());
  }
  // A canvas mid-trace will not sit still for a screenshot, so grab its own
  // pixels instead.
  const png = await page.evaluate(() => document.querySelector(".render-canvas canvas").toDataURL("image/png"));
  await import("node:fs").then((fs) => fs.writeFileSync(`${out}/r-traced-${label}.png`,
    Buffer.from(png.split(",")[1], "base64")));
  // Stopping mid-trace: the button is repainting every frame, so ask the DOM
  // rather than waiting for it to hold still.
  await page.evaluate(() => [...document.querySelectorAll(".render-chips button")]
    .find((b) => b.textContent === "Stop")?.click());
  await page.waitForTimeout(800);
};
await trace("parallel");
await page.locator(".render-chips").getByRole("button", { name: "Perspective" }).click();
await page.waitForTimeout(1200);
await trace("perspective");
await browser.close();
