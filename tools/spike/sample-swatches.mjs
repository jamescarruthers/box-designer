// §18 What colour is a Valchromat board, actually?
//
// Sampled from the supplier's own swatch photographs rather than guessed. The
// photographs are not redistributed and nothing is kept but the numbers: a
// median colour, and how far the speckle strays from it, which is what the
// board's surface is made of and what the render tints.
//
// Median rather than mean: a swatch photograph has the odd dark fleck and the
// odd blown highlight, and a mean chases both.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
await page.goto("about:blank");

for (const file of fs.readdirSync(dir).filter((f) => /\.(jpe?g|webp|png)$/i.test(f)).sort()) {
  const b64 = fs.readFileSync(path.join(dir, file)).toString("base64");
  const type = file.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const out = await page.evaluate(async ([b64, type]) => {
    const bmp = await createImageBitmap(await (await fetch(`data:${type};base64,${b64}`)).blob());
    // The middle half only: the edges of a product photograph are vignette,
    // shadow, and whatever the board is standing on.
    const w = Math.round(bmp.width / 2), h = Math.round(bmp.height / 2);
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, bmp.width / 4, bmp.height / 4, w, h, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const ch = [[], [], []];
    for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) ch[k].push(data[i + k]);
    const med = ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
    // How much the surface varies, in luminance: the speckle, in a number.
    const lum = [];
    for (let i = 0; i < data.length; i += 4) lum.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    lum.sort((a, b) => a - b);
    const at = (q) => lum[Math.floor(q * (lum.length - 1))];
    return { med, size: [bmp.width, bmp.height], p05: at(0.05), p50: at(0.5), p95: at(0.95) };
  }, [b64, type]);

  const hex = `#${out.med.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  const spread = ((out.p95 - out.p05) / Math.max(1, out.p50) * 100).toFixed(1);
  console.log(`${file.replace(/Valchromat-|-Colour.*/g, "").padEnd(12)} ${hex}  rgb(${out.med.join(", ")})` +
    `  speckle ±${spread}% of mid  (${out.size.join("×")})`);
}
await browser.close();
