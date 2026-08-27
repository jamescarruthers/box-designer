// §56 The drawing's isometric, from the kernel, together and apart.
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const out = process.argv[2];
await mkdir(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1700, height: 950 }, deviceScaleFactor: 1.5 });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });
await p.goto("http://localhost:5012/", { waitUntil: "networkidle" });

await p.getByLabel("Drawing title").fill("ENGINE CHECK");
// Something the analytic isometric cannot draw: a fillet and a driver.
await p.getByLabel("Open the Front carcass").click();
await p.getByLabel(/Add a fitting/).selectOption("driver");
await p.getByLabel("Close the panel inspector").click();
await p.getByRole("button", { name: "Fillet" }).first().click();

await p.getByRole("button", { name: "Drawing" }).click();
console.log("engine buttons:", await p.locator(".sheet-chips .engine button").allTextContents());
console.log("which is on:", await p.locator(".sheet-chips .engine button.on").textContent());

const note = () => p.locator(".engine-state").textContent();
const isoLines = () => p.locator('.sheet-holder g[data-view="iso"] path').count();

for (const ex of [0, 60]) {
  if (ex) {
    await p.getByRole("button", { name: "3D view" }).click();
    await p.locator("#iso-explode").fill(String(ex));
    await p.getByRole("button", { name: "Drawing" }).click();
  }
  // Wait for the kernel to arrive.
  for (let i = 0; i < 60; i++) {
    if (/B-Rep/.test(await note())) break;
    await p.waitForTimeout(1000);
  }
  console.log(`explode ${String(ex).padStart(2)}  ${await note()}  |  ${await isoLines()} iso paths`);
  await p.screenshot({ path: join(out, `sheet-${ex}.png`) });
  const svg = await p.locator(".sheet-holder").innerHTML();
  await writeFile(join(out, `sheet-${ex}.svg`), svg);
}

// And back to the analytic sheet, which is still there.
await p.getByRole("button", { name: "Analytic" }).click();
await p.waitForTimeout(400);
console.log(`analytic     ${await note()}  |  ${await isoLines()} iso paths`);
await p.screenshot({ path: join(out, "sheet-analytic.png") });
await b.close();
