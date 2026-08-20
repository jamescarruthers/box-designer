// §17 How much ink the two edge passes actually put on the screen.
//
// The faint pass was calibrated by measurement when it was one device pixel
// wide (§4). Widening the lines changes what that calibration was measuring, so
// this measures it again rather than trusting the number: wireframe with hidden
// removed is the visible pass alone, wireframe is both, and the difference is
// what the faint pass contributes.
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5011";
const label = process.argv[3] ?? "now";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

/** Ink: how far every pixel is above the dark ground, added up. */
async function ink(style) {
  await page.getByRole("button", { name: style, exact: true }).click();
  await page.waitForTimeout(500);
  // Below the chips: they sit over the canvas, and which one is lit changes
  // between the two styles — an orange button is a great deal of ink.
  const box = await page.locator(".viewport").boundingBox();
  const shot = await page.screenshot({ clip: {
    x: box.x, y: box.y + box.height * 0.25, width: box.width, height: box.height * 0.7 } });
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    let total = 0, lit = 0, peak = 0;
    for (let i = 0; i < data.length; i += 4) {
      // The ground is 0x14181d; anything above it is line.
      const over = (data[i] - 0x14) + (data[i + 1] - 0x18) + (data[i + 2] - 0x1d);
      if (over > 6) { total += over; lit++; peak = Math.max(peak, over); }
    }
    return { total, lit, peak };
  }, shot.toString("base64"));
}

const visible = await ink("Wireframe, hidden removed");
const both = await ink("Wireframe");
const hidden = { total: both.total - visible.total, lit: both.lit - visible.lit };

console.log(label);
console.log("  visible pass   ", visible);
console.log("  both passes    ", both);
console.log("  faint pass ink ", hidden.total, `(${(100 * hidden.total / visible.total).toFixed(1)}% of the visible pass)`);
console.log("  ink per lit px ", (visible.total / visible.lit).toFixed(1), "visible,",
  (hidden.total / Math.max(1, hidden.lit)).toFixed(1), "faint");
await browser.close();
