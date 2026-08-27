// §58 The right-click menu, in the app.
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
await p.getByLabel("Drawing title").fill("MENU CHECK");
await p.waitForTimeout(1500);

const canvas = await p.locator(".pane-view .viewport").boundingBox();
const at = (fx, fy) => ({ x: canvas.x + canvas.width * fx, y: canvas.y + canvas.height * fy });
const right = async (fx, fy) => {
  const q = at(fx, fy);
  await p.mouse.move(q.x, q.y);
  await p.mouse.click(q.x, q.y, { button: "right" });
  await p.waitForTimeout(250);
};
const menu = () => p.locator(".context-menu");
const title = async () => (await menu().count()) ? menu().locator("header").textContent() : "(no menu)";
const items = async () => (await menu().count())
  ? p.locator('.context-menu [role="menuitem"]').evaluateAll((bs) =>
      bs.map((x) => x.querySelector(".what").textContent + (x.disabled ? " [off]" : "")))
  : [];

// A face, near the middle of the front-left panel.
await right(0.42, 0.55);
console.log("face menu:", await title(), "\n  ", (await items()).join(" | "));
await p.screenshot({ path: join(out, "face-menu.png") });
console.log("inspector open?", (await p.locator(".inspector").count()) > 0, "(a right-click should not select)");

// Add a doubler from it, and see the box change.
const parts = () => p.locator(".modes .stat").nth(1).textContent();
console.log("before:", await parts());
if (await menu().count()) {
  await p.getByRole("menuitem", { name: "Add doubler" }).click();
  await p.waitForTimeout(600);
}
console.log("after adding a doubler:", await parts());

// An edge: near a vertical corner of the box.
await right(0.5, 0.5);
await p.keyboard.press("Escape");
for (const [fx, fy] of [[0.545, 0.62], [0.55, 0.5], [0.46, 0.3]]) {
  await right(fx, fy);
  const t = await title();
  if (t.includes("edge")) {
    console.log("edge menu:", t, "\n  ", (await items()).join(" | "));
    await p.screenshot({ path: join(out, "edge-menu.png") });
    const mitre = p.getByRole("menuitem", { name: "Mitre" });
    const pick = await mitre.isEnabled() ? mitre : p.getByRole("menuitem", { name: /Fillet/ });
    const what = await pick.locator(".what").textContent();
    if (!(await pick.isEnabled())) { console.log("nothing on that edge is offered"); await p.keyboard.press("Escape"); break; }
    await pick.click();
    await p.waitForTimeout(700);
    console.log(`applied "${what}" — edges treated:`,
      await p.locator(".edge-list li, .treated li").count(),
      "| warnings:", (await p.locator(".messages p").allTextContents()).length);
    break;
  }
  await p.keyboard.press("Escape");
}

// Prominence, from the menu.
await right(0.42, 0.55);
console.log("prominence items:", (await items()).filter((i) => /front|back/i.test(i)).join(" | "));
const order = () => p.locator(".rank-summary.for-shell li").allTextContents();
console.log("order before:", (await order()).join(" "));
if (await menu().count()) {
  const bring = p.getByRole("menuitem", { name: /Bring to the front/ });
  if (await bring.isEnabled()) await bring.click();
  else await p.getByRole("menuitem", { name: /Send to the back/ }).click();
  await p.waitForTimeout(600);
}
console.log("order after :", (await order()).join(" "));
await p.screenshot({ path: join(out, "after.png") });
await b.close();
