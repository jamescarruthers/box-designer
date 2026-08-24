// §32 The drawing options in the app: the stipple, the two switches, and what
// the isometric does with the room the section leaves behind.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5017/";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Line the box so there is something to stipple.
for (const face of ["front", "back", "left", "right", "top", "bottom"]) {
  await page.locator(".controls").getByLabel("Add lagging", { exact: true }).selectOption(face);
}
await page.waitForTimeout(500);
await page.locator(".modes button", { hasText: "Drawing" }).first().click();
await page.waitForTimeout(1200);

const state = async (what) => {
  const svg = await page.locator(".sheet-holder").innerHTML();
  const iso = await page.locator('[data-view="iso"] text').first().innerText().catch(() => "");
  console.log(what.padEnd(26),
    "| section", /SECTION A–A/.test(svg) ? "yes" : "no ",
    "| stipple", (svg.match(/url\(#hatch-lagging\)/g) ?? []).length,
    "| iso", (await page.locator(".sheet-chips").innerText()).match(/ISO ([\d:]+)/)?.[1] ?? "?");
};

await state("both on");
await page.screenshot({ path: `${out}/drawing-both.png` });

await page.locator(".controls").getByLabel("Acoustic insulation", { exact: true }).click();
await page.waitForTimeout(600);
await state("insulation off");
await page.screenshot({ path: `${out}/drawing-no-insulation.png` });

await page.locator(".controls").getByLabel("Acoustic insulation", { exact: true }).click();
await page.locator(".controls").getByLabel("Section A–A", { exact: true }).click();
await page.waitForTimeout(600);
await state("section off");
await page.screenshot({ path: `${out}/drawing-no-section.png` });

// And through the kernel, which draws the same sheet from its own geometry.
await page.locator(".sheet-chips .engine button", { hasText: "OpenCASCADE" }).click();
await page.waitForTimeout(11000);
await state("section off, kernel");
await page.screenshot({ path: `${out}/drawing-no-section-kernel.png` });
await browser.close();
