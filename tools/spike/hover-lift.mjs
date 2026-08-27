// Is the hover lift actually visible? Compare the same pixels with and without.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
await p.goto("http://localhost:5012/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const box = await p.locator(".pane-view .viewport").boundingBox();
const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
const clip = { x: box.x + box.width * 0.36, y: box.y + box.height * 0.5, width: 60, height: 60 };
const edgeClip = { x: box.x + box.width * 0.523, y: box.y + box.height * 0.55, width: 40, height: 90 };

const mean = async () => {
  const shot = (await p.screenshot({ clip })).toString("base64");
  return p.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let r = 0, gg = 0, bb = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; gg += data[i + 1]; bb += data[i + 2]; n++; }
    return [r / n, gg / n, bb / n];
  }, shot);
};

const away = at(0.05, 0.92);
await p.mouse.move(away.x, away.y); await p.waitForTimeout(300);
const cold = await mean();
const on = at(0.42, 0.55);
await p.mouse.move(on.x, on.y); await p.waitForTimeout(300);
const hot = await mean();
console.log("not hovered:", cold.map((v) => v.toFixed(1)).join(", "));
console.log("hovered    :", hot.map((v) => v.toFixed(1)).join(", "));
console.log("difference :", hot.map((v, i) => (v - cold[i]).toFixed(1)).join(", "));

// §59 And the edge hint, which is the point of hovering an edge at all.
const meanOf = async (region) => {
  const shot = (await p.screenshot({ clip: region })).toString("base64");
  return p.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let r = 0, gg = 0, bb = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; gg += data[i + 1]; bb += data[i + 2]; n++; }
    return [r / n, gg / n, bb / n];
  }, shot);
};
await p.mouse.move(away.x, away.y); await p.waitForTimeout(300);
const edgeCold = await meanOf(edgeClip);
for (const [fx, fy] of [[0.545, 0.62], [0.55, 0.5], [0.535, 0.7]]) {
  const q = at(fx, fy);
  await p.mouse.move(q.x, q.y); await p.waitForTimeout(300);
  const line = p.locator(".selection.hovering");
  const t = (await line.count()) ? await line.textContent() : "";
  if (!t.includes("edge")) continue;
  const edgeHot = await meanOf(edgeClip);
  console.log("edge hint  :", t);
  console.log("  without  :", edgeCold.map((v) => v.toFixed(1)).join(", "));
  console.log("  with     :", edgeHot.map((v) => v.toFixed(1)).join(", "));
  console.log("  change   :", edgeHot.map((v, i) => (v - edgeCold[i]).toFixed(1)).join(", "));
  break;
}
await b.close();
