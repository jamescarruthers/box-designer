// §55 In the browser: does the camera stay on the box as it comes apart, and
// does shift-drag move it about the frame?
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const out = process.argv[2];
await mkdir(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1.5 });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });
await p.goto("http://localhost:5012/", { waitUntil: "networkidle" });

await p.getByLabel("Drawing title").fill("AIM CHECK");
// Clad the front only, so the assembly comes apart lopsidedly.
await p.getByLabel("Open the Front carcass").click();
await p.getByRole("button", { name: "Add cladding" }).click();
await p.getByLabel("Close the panel inspector").click();
await p.getByRole("button", { name: "Render" }).click();
await p.waitForTimeout(2500);

/**
 * Where the box's pixels sit in the canvas, as a fraction of it.
 *
 * Read from a page screenshot rather than from the live canvas: the renderer
 * does not preserve its drawing buffer, so reading it back after the frame is
 * composited gives nothing. The screenshot is decoded on a 2D canvas, which
 * does read back.
 */
async function spread() {
  const clip = await p.locator(".render-canvas").boundingBox();
  const shot = (await p.screenshot({ clip })).toString("base64");
  return p.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const g = document.createElement("canvas");
    g.width = img.width; g.height = img.height;
    const ctx = g.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, g.width, g.height);
    // The box is wood against a neutral sweep: take the markedly warm pixels.
    let n = 0, sx = 0, sy = 0, lo = 1e9, hi = -1e9;
    for (let y = 0; y < g.height; y += 2) {
      for (let x = 0; x < g.width; x += 2) {
        const i = (y * g.width + x) * 4;
        if (data[i] - data[i + 2] < 26) continue;
        n++; sx += x; sy += y;
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
    }
    if (!n) return null;
    return { cx: sx / n / g.width, cy: sy / n / g.height, top: lo / g.height, bottom: hi / g.height,
      share: (n * 4) / (g.width * g.height) };
  }, shot);
}

for (const ex of [0, 40, 80, 120]) {
  await p.locator("#render-explode").fill(String(ex));
  await p.waitForTimeout(900);
  const s = await spread();
  if (!s) { console.log('explode', ex, 'NO BOX PIXELS FOUND'); continue; }
  console.log(`explode ${String(ex).padStart(3)}  centroid y ${s.cy.toFixed(3)}  top ${s.top.toFixed(3)}  bottom ${s.bottom.toFixed(3)}  fills ${(s.share*100).toFixed(1)}%`);
  await p.screenshot({ path: join(out, `aim-${ex}.png`) });
}

// --- the pan
await p.locator("#render-explode").fill("40");
await p.waitForTimeout(700);
const before = await spread();
const box = await p.locator(".render-canvas").boundingBox();
await p.keyboard.down("Shift");
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2 - 90, { steps: 12 });
await p.mouse.up();
await p.keyboard.up("Shift");
await p.waitForTimeout(900);
const after = await spread();
console.log(`pan: centroid x ${before.cx.toFixed(3)} -> ${after.cx.toFixed(3)}, y ${before.cy.toFixed(3)} -> ${after.cy.toFixed(3)}`);
console.log("Recentre enabled:", await p.getByRole("button", { name: "Recentre" }).isEnabled());
await p.screenshot({ path: join(out, "panned.png") });

await p.getByRole("button", { name: "Recentre" }).click();
await p.waitForTimeout(900);
const back = await spread();
console.log(`recentred: centroid x ${back.cx.toFixed(3)}, y ${back.cy.toFixed(3)} (was ${before.cx.toFixed(3)}, ${before.cy.toFixed(3)})`);
console.log("Recentre enabled after:", await p.getByRole("button", { name: "Recentre" }).isEnabled());
await p.screenshot({ path: join(out, "recentred.png") });
await b.close();
