// §21 Drive the inspector in the real app: select a panel in the 3D view, change
// things on it, and read the box back.
import { chromium } from "playwright-core";

const OUT = process.env.OUT ?? "/tmp";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
await page.goto("http://localhost:5011/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

// Click the box in the 3D view to select the panel under the pointer.
const box = await page.locator(".pane-view .viewport").boundingBox();
await page.mouse.click(box.x + box.width * 0.44, box.y + box.height * 0.55);
await page.waitForTimeout(500);

const open = await page.locator(".inspector").count();
console.log("inspector open after a click in 3D:", open);
if (!open) { await page.screenshot({ path: `${OUT}/inspect-miss.png` }); await browser.close(); process.exit(1); }

const title = await page.locator(".inspector-title").innerText();
console.log("looking at:", title.replace(/\n/g, " "));
const face = (await page.locator(".inspector").getAttribute("aria-label")).split(" ")[0];
await page.screenshot({ path: `${OUT}/inspect-open.png` });

// The face's own thickness, from a box that was uniform.
await page.getByLabel(`${face} thickness`).fill("25");
await page.getByLabel(`${face} thickness`).blur();
await page.waitForTimeout(400);
console.log("selection bar:", await page.locator(".selection").innerText());

// A doubler on this face.
await page.locator(".inspector").getByRole("button", { name: "Add doubler" }).click();
await page.waitForTimeout(400);
console.log("layers:", (await page.locator(".layer-list").innerText()).replace(/\n/g, " | "));
console.log("parts:", await page.locator(".modes .stat").nth(1).innerText());

// A driver on this face.
await page.locator(".inspector").getByLabel(new RegExp(`Add a fitting to the ${face}`, "i"))
  .selectOption("driver");
await page.waitForTimeout(400);
console.log("fittings on this face:", await page.locator(".inspector .fitting").count());
console.log("set out on:", await page.locator(".inspector .fitting .on-face").first().innerText());

// One of its edges.
const edgeSel = page.locator(".inspector .edge-row select").first();
const edgeName = await page.locator(".inspector .edge-row .edge-key").first().innerText();
await edgeSel.selectOption("fillet").catch(() => console.log("first edge cannot take a fillet"));
await page.waitForTimeout(400);
console.log("edge:", edgeName.replace(/\n/g, " — "), "→", await edgeSel.inputValue());

await page.screenshot({ path: `${OUT}/inspect-edited.png` });

// Does the middle column still hold together with three columns up?
const wide = await page.evaluate(() => ({
  body: document.body.scrollWidth <= window.innerWidth,
  cols: getComputedStyle(document.querySelector(".app")).gridTemplateColumns,
}));
console.log("no sideways scroll:", wide.body, "| columns:", wide.cols);

// And the cut list, which has three columns of its own.
await page.getByRole("button", { name: "Cut list & sheets" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/inspect-cuts.png` });
console.log("cut list fits:", await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));

// Step to the doubler on the same face.
await page.getByRole("button", { name: new RegExp(`Inspect the ${face} doubler`, "i") }).click();
await page.waitForTimeout(300);
console.log("stepped to:", await page.locator(".inspector").getAttribute("aria-label"));

await page.getByRole("button", { name: "Close the panel inspector" }).click();
await page.waitForTimeout(300);
console.log("closed:", (await page.locator(".inspector").count()) === 0);

await browser.close();
