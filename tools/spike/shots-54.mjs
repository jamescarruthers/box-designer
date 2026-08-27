// §54 The two bugs, in the app: the rebated isometric and the exploded render.
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const out = process.argv[2];
await mkdir(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1600, height: 940 }, deviceScaleFactor: 1.5 });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });
await p.goto("http://localhost:5012/", { waitUntil: "networkidle" });

// A box with rebates on the two least prominent faces, and cladding so the
// render has something to fling about.
await p.getByLabel("Drawing title").fill("REBATE CHECK");
for (const f of ["Top", "Bottom"]) {
  await p.getByLabel(`Open the ${f} carcass`).click();
  for (const side of ["front", "back", "left", "right"]) {
    const chip = p.getByLabel(`${f} rebate ${side}`);
    if (await chip.count()) await chip.first().click();
  }
}
for (const f of ["Front", "Back", "Left", "Right", "Top", "Bottom"]) {
  await p.getByLabel(`Open the ${f} carcass`).click();
  await p.getByRole("button", { name: "Add cladding" }).click();
}
await p.getByLabel("Close the panel inspector").click();
console.log("messages:", await p.locator(".messages p").allTextContents());

// The drawing's isometric.
await p.getByRole("button", { name: "Drawing" }).click();
await p.waitForTimeout(1500);
await p.screenshot({ path: join(out, "drawing.png") });
const svg = await p.locator(".sheet-holder svg").first();
await svg.screenshot({ path: join(out, "sheet.png") });

// The rendered view, exploded.
await p.getByRole("button", { name: "Render" }).click();
await p.waitForTimeout(2500);
await p.screenshot({ path: join(out, "render-0.png") });
await p.locator("#render-explode").fill("60");
await p.waitForTimeout(2000);
await p.screenshot({ path: join(out, "render-60.png") });
await p.locator("#render-explode").fill("120");
await p.waitForTimeout(2000);
await p.screenshot({ path: join(out, "render-120.png") });
await b.close();
