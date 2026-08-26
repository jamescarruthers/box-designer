// §52/§53 In the browser: does a design actually leave as a file and come back,
// and does the doublers' own order redraw the box?
import { chromium } from "playwright-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = process.argv[2] ?? "/tmp/sbox";
await mkdir(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1600, height: 940 }, deviceScaleFactor: 1.5 });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });
await p.goto("http://localhost:5012/", { waitUntil: "networkidle" });

const say = (...a) => console.log(...a);

// ---------------------------------------------------------------- §53 first
await p.getByLabel("Drawing title").fill("HARMAN 12");
for (const f of ["Front", "Back", "Left", "Right", "Top", "Bottom"]) {
  await p.getByLabel(`Open the ${f} carcass`).click();
  await p.getByRole("button", { name: "Add doubler" }).click();
}
await p.getByLabel("Close the panel inspector").click();

const cuts = async () => {
  await p.getByRole("button", { name: "Cut list & sheets" }).click();
  const rows = await p.$$eval("table.cuts tbody tr", (trs) => trs.map((r) =>
    [...r.children].slice(1, 5).map((c) => c.textContent.trim()).join(" ")));
  await p.getByRole("button", { name: "3D view" }).click();
  return rows;
};
const before = await cuts();
say("doublers, following the box:", before.filter((r) => r.includes("Doubler")));

await p.getByRole("button", { name: "Their own order" }).click();
const copied = await cuts();
say("unchanged when switched on:", JSON.stringify(copied) === JSON.stringify(before));

await p.getByLabel("Doubler preset").selectOption("tb");
const after = await cuts();
say("doublers, their own order: ", after.filter((r) => r.includes("Doubler")));
say("carcass untouched:",
  JSON.stringify(after.filter((r) => r.includes("Carcass"))) ===
  JSON.stringify(before.filter((r) => r.includes("Carcass"))));
await p.screenshot({ path: join(out, "prominence.png") });

// §53 the inspector agrees with the sidebar
await p.getByLabel("Open the Top doubler").click();
say("top doubler rank:", await p.locator(".inspector .rank-row .rank").textContent(),
    (await p.locator(".inspector .rank-row .name").textContent()));
await p.getByLabel("Close the panel inspector").click();

// ----------------------------------------------------------------- §52 save
const dl = p.waitForEvent("download");
await p.getByRole("button", { name: "Save" }).click();
const file = await dl;
const path = join(out, file.suggestedFilename());
await file.saveAs(path);
const text = await readFile(path, "utf8");
const doc = JSON.parse(text);
say("saved as:", file.suggestedFilename(), "| format:", doc.format,
    "| title:", doc.design.title, "| doubler order:", doc.design.prominence.doubler.order.join(","));
say("note:", await p.locator(".file-note").textContent());

// ----------------------------------------------------------------- §52 open
// A different box in a file, opened over this one.
const other = { ...doc, design: { ...doc.design, title: "OPENED FROM DISK", thickness: 12,
  prominence: { doubler: null }, extra: "a field this app has never heard of" } };
const otherPath = join(out, "other.json");
await writeFile(otherPath, JSON.stringify(other, null, 2));
await p.setInputFiles(".hidden-file", otherPath);
await p.waitForTimeout(300);
say("after opening:", await p.getByLabel("Drawing title").inputValue(),
    "| thickness", await p.getByLabel("Thickness").inputValue());
say("note:", await p.locator(".file-note").textContent());
say("doubler control back to following:",
    await p.getByRole("button", { name: "As the carcass" }).getAttribute("class"));
await p.screenshot({ path: join(out, "opened.png") });

// And a file that is not a design at all.
const junkPath = join(out, "junk.json");
await writeFile(junkPath, JSON.stringify({ nodes: [], links: [] }));
await p.setInputFiles(".hidden-file", junkPath);
await p.waitForTimeout(300);
say("refusal:", await p.locator(".file-note").textContent());
say("box kept:", await p.getByLabel("Drawing title").inputValue());
await p.screenshot({ path: join(out, "refused.png") });

// The box still solves, and the drawing still draws.
await p.getByRole("button", { name: "Drawing" }).click();
await p.waitForTimeout(1200);
say("sheet drawn:", await p.locator(".sheet-holder svg").count());
await p.screenshot({ path: join(out, "drawing.png") });
await b.close();
