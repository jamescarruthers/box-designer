// §57 The sheet on screen: a physical size on the element must not stop the app
// scaling it to the room it has.
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const out = process.argv[2];
await mkdir(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1700, height: 950 }, deviceScaleFactor: 2 });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await p.goto("http://localhost:5012/", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Drawing" }).click();
await p.waitForTimeout(1200);
const box = await p.locator(".sheet-holder svg").boundingBox();
const holder = await p.locator(".sheet-holder").boundingBox();
console.log("svg on screen:", Math.round(box.width), "x", Math.round(box.height),
  "in a holder", Math.round(holder.width), "x", Math.round(holder.height),
  "| aspect", (box.width / box.height).toFixed(3), "(A3 is 1.414)");
console.log("fits:", box.width <= holder.width + 1 && box.height <= holder.height + 1);
await p.screenshot({ path: join(out, "in-app.png") });
await b.close();
