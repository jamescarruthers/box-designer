// §26 A fillet the size of the wall is the shape OCCT refuses. With the message
// helper compiled into the kernel, does the note now say why it refused it
// instead of printing the address of the exception?
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function note(patch) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await page.evaluate((p) => localStorage.setItem("sheet-box-designer/design/1", JSON.stringify(p)), patch);
  await page.reload({ waitUntil: "domcontentloaded" });
  const t0 = Date.now();
  let out = "STUCK";
  while (Date.now() - t0 < 60000) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep|Try again/.test(n)) { out = n.replace(/\n/g, " "); break; }
    await page.waitForTimeout(150);
  }
  await page.close();
  return out;
}

console.log("fillet R18 on an 18 mm wall:");
console.log("  ", await note({ edge: { type: "fillet", radius: 18, perEdge: false, by: {} } }));
console.log("chamfer R18 on an 18 mm wall:");
console.log("  ", await note({ edge: { type: "chamfer", radius: 18, perEdge: false, by: {} } }));
console.log("fillet R12, which fits:");
console.log("  ", await note({ edge: { type: "fillet", radius: 12, perEdge: false, by: {} } }));
await browser.close();
