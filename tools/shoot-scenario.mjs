// Drive the built app through a mixed-material box and screenshot it.
import { chromium } from "playwright-core";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });

// A birch carcass with a Valchromat baffle and an MDF doubler behind it.
await page.getByLabel("Add cladding").selectOption("front");
await page.getByLabel("Cladding Front material").selectOption("valchromat");
await page.getByLabel("Add doublers").selectOption("back");
await page.getByLabel("Doublers Back material").selectOption("mdf");
await page.getByLabel("Doublers Back thickness").fill("25");
await page.getByRole("button", { name: "Fillet", exact: true }).click();
await page.getByLabel("Radius").fill("10");
await page.waitForTimeout(700);

await page.screenshot({ path: `${out}/mix-view.png` });
await page.locator("#explode").fill("70");
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/mix-explode.png` });
await page.getByRole("button", { name: "Cut list & sheets", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/mix-cuts.png` });
console.log(errs.length ? errs.join("\n") : "no page errors");
await browser.close();
