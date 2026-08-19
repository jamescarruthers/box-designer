// Drive the built app in Chromium and screenshot each mode (§9.6, render and look).
import { chromium } from "playwright-core";
const [base, outDir] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
const problems = [];
page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
page.on("pageerror", (e) => problems.push(String(e)));
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
for (const [mode, name] of [["3D view", "view"], ["Cut list & sheets", "cuts"], ["Drawing", "drawing"]]) {
  await page.getByRole("button", { name: mode, exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/app-${name}.png` });
}
console.log(problems.length ? "CONSOLE PROBLEMS:\n" + problems.join("\n") : "no console errors");
await browser.close();
