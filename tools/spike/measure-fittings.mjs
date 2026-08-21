// §21 How much room a fitting's numbers actually get, in the inspector and in
// the sidebar. "A bit tight" is a measurement, so measure it.
import { chromium } from "playwright-core";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("http://localhost:5011/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

// A driver on the front, from the sidebar, then select that face.
await page.locator(".controls").getByLabel("Add a fitting", { exact: true }).selectOption("driver");
await page.waitForTimeout(400);

const box = await page.locator(".pane-view .viewport").boundingBox();
await page.mouse.click(box.x + box.width * 0.44, box.y + box.height * 0.55);
await page.waitForTimeout(500);
// Whichever face that was, put the fitting on it so the inspector shows one.
const face = (await page.locator(".inspector").getAttribute("aria-label")).split(" ")[0].toLowerCase();
await page.locator(".controls .fitting select").first().selectOption(face);
await page.waitForTimeout(500);

const measure = (root) => page.evaluate((sel) => {
  const scope = document.querySelector(sel);
  const grid = scope.querySelector(".fitting-grid");
  if (!grid) return null;
  const fields = [...grid.querySelectorAll(".field")];
  return {
    columns: getComputedStyle(grid).gridTemplateColumns,
    fields: fields.map((f) => {
      const label = f.querySelector("span:first-child");
      const input = f.querySelector("input");
      // Does the number fit? scrollWidth beyond clientWidth means it is clipped.
      return {
        label: label.textContent,
        labelWidth: Math.round(label.getBoundingClientRect().width),
        inputWidth: Math.round(input.getBoundingClientRect().width),
        value: input.value,
        clipped: input.scrollWidth > input.clientWidth + 1,
      };
    }),
  };
}, root);

for (const [name, sel] of [["inspector", ".inspector"], ["sidebar", ".controls"]]) {
  const m = await measure(sel);
  if (!m) { console.log(name, "— no fitting shown"); continue; }
  console.log(`\n${name}: columns ${m.columns}`);
  for (const f of m.fields) {
    console.log(`  ${f.label.padEnd(10)} label ${String(f.labelWidth).padStart(3)}px  input ${String(f.inputWidth).padStart(3)}px  "${f.value}"${f.clipped ? "  ← CLIPPED" : ""}`);
  }
}

await page.locator(".inspector-body").evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/fittings-now.png` });
await browser.close();
