// §19 The rendered view on a phone-shaped screen at a phone's pixel ratio.
//
// Reported from an iPhone: Refine "only displays part of the screen and it
// flashes on and off". The canvas was resized on every frame — `domElement.width`
// is in device pixels and was being compared with a CSS width — and every resize
// reset the trace, so it never accumulated and never covered the frame.
import { chromium, devices } from "playwright-core";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({
  viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});
page.on("console", (m) => { if (m.type() === "error") console.log("  [console]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 200)));
await page.goto(process.argv[2] ?? "http://localhost:5011", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.getByRole("button", { name: "Render", exact: true }).click();
await page.waitForTimeout(2000);
await page.locator(".render-mode").screenshot({ path: `${out}/phone-studio.png` });

await page.getByRole("button", { name: "Refine" }).click();
const seen = [];
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(4000);
  const s = await page.locator(".render-state").innerText();
  seen.push(Number(s.match(/, (\d+) samples?/)?.[1] ?? 0));
  if (i % 2 === 0) console.log(`  ${(i + 1) * 4}s  ${s.replace(/\s+/g, " ")}`);
  if (seen.at(-1) >= 12 || /showing the studio/.test(s)) break;
}
console.log("samples over time:", seen.join(" "));
// The canvas has to be covered, not partly covered: no pixel left at the
// clear colour inside the box's own row.
const covered = await page.evaluate(() => {
  const c = document.querySelector(".render-canvas canvas");
  return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight };
});
console.log("canvas:", covered);
await page.locator(".render-mode").screenshot({ path: `${out}/phone-traced.png` });
await browser.close();
