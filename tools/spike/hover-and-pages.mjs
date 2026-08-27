// §59 Hover on faces and edges, and the sheet pages on the menu.
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
await p.getByLabel("Drawing title").fill("HOVER CHECK");
// Valchromat, so the colour page has a range.
await p.locator(".controls select").evaluateAll((els) => {
  const sheet = els.find((e) => [...e.options].some((o) => o.value === "valchromat"));
  sheet.value = "valchromat";
  sheet.dispatchEvent(new Event("change", { bubbles: true }));
});
await p.waitForTimeout(1500);

const canvas = await p.locator(".pane-view .viewport").boundingBox();
const at = (fx, fy) => ({ x: canvas.x + canvas.width * fx, y: canvas.y + canvas.height * fy });
const hoverAt = async (fx, fy) => {
  const q = at(fx, fy);
  await p.mouse.move(q.x, q.y);
  await p.waitForTimeout(180);
  const line = p.locator(".selection.hovering");
  return (await line.count()) ? (await line.textContent()) : "(nothing)";
};

console.log("--- hover");
console.log("middle of a face :", await hoverAt(0.42, 0.55));
for (const [fx, fy] of [[0.545, 0.62], [0.55, 0.45], [0.463, 0.29], [0.62, 0.35]]) {
  const t = await hoverAt(fx, fy);
  if (t.includes("edge")) { console.log("near an edge     :", t); break; }
}
console.log("off the box      :", await hoverAt(0.05, 0.9));
await hoverAt(0.42, 0.55);
await p.screenshot({ path: join(out, "hover-face.png") });

console.log("--- pages");
const q = at(0.42, 0.55);
await p.mouse.click(q.x, q.y, { button: "right" });
await p.waitForTimeout(250);
const items = () => p.locator('.context-menu [role="menuitem"]').evaluateAll((bs) =>
  bs.map((x) => x.querySelector(".what").textContent + (x.disabled ? " [off]" : "")));
const head = () => p.locator(".context-menu header").textContent();
console.log("menu :", await head(), "\n  ", (await items()).join(" | "));

await p.getByRole("menuitem", { name: /^Sheet/ }).click();
await p.waitForTimeout(200);
console.log("board:", await head(), "\n  ", (await items()).join(" | "));
await p.screenshot({ path: join(out, "page-board.png") });

await p.getByRole("menuitem", { name: "Back" }).click();
await p.waitForTimeout(200);
await p.getByRole("menuitem", { name: /^Colour/ }).click();
await p.waitForTimeout(200);
console.log("colour:", await head(), "\n  ", (await items()).join(" | "));
await p.screenshot({ path: join(out, "page-colour.png") });

const before = await p.locator(".modes .stat").first().textContent();
await p.getByRole("menuitem", { name: /Green Mint/ }).click();
await p.waitForTimeout(700);
console.log("menu gone:", (await p.locator(".context-menu").count()) === 0);
await p.getByRole("button", { name: "Cut list & sheets" }).click();
await p.waitForTimeout(400);
const colours = await p.locator("table.cuts tbody tr td.colour-cell").allTextContents();
console.log("cut list colours:", colours.slice(0, 6).join(" | "));
await p.screenshot({ path: join(out, "painted.png") });
await b.close();
