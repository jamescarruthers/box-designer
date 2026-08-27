// §57 The sheet at the size it would be printed.
//
// The SVG's user unit is a millimetre — SHEET is 420 x 297 — so a line width of
// 0.7 is 0.7 mm on paper. Render it at true size and crop a detail, and the
// question "would this look right on A3" stops being a thought experiment.
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_DESIGN, derive, addPanel, setIn } from "../../src/ui/design.js";
import { newFitting } from "../../src/model/fittings.js";
import { LW, TS } from "../../src/drawing/sheet.js";

const [out, tag = "now"] = process.argv.slice(2);
await mkdir(out, { recursive: true });

let d = setIn(DEFAULT_DESIGN, ["edge", "type"], "fillet");
d = addPanel(d, "doubler", "front");
d = { ...d, title: "LINE WEIGHT", fittings: [{ ...newFitting("driver", "front"), at: { a: 118, b: 178 } }] };
const { sheet } = derive(d);
await writeFile(join(out, `${tag}.svg`), sheet.svg);

console.log(`${tag}  line widths mm:`, JSON.stringify(LW));
console.log(`${tag}  text heights mm:`, JSON.stringify(TS));
console.log(`${tag}  svg header:`, sheet.svg.slice(0, 120));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
// deviceScaleFactor 3 over CSS millimetres is about 288 dpi — print resolution.
const p = await b.newPage({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 3 });
await p.setContent(`<style>html,body{margin:0;background:#fff}
  .page{width:420mm;height:297mm}</style><div class="page">${sheet.svg}</div>`);
await p.evaluate(() => {
  const s = document.querySelector("svg");
  s.setAttribute("width", "420mm");
  s.setAttribute("height", "297mm");
});
// The whole sheet, and then a detail at true size: the front elevation's
// corner, where a visible line, a hidden line, a dimension and text all meet.
await p.locator("svg").screenshot({ path: join(out, `${tag}-full.png`) });
await p.screenshot({ path: join(out, `${tag}-detail.png`),
  clip: { x: 140, y: 130, width: 460, height: 330 } });
await b.close();
console.log("wrote", tag);
