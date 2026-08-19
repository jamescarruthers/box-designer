import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
page.on("console", (m) => console.log(`[${m.type()}]`, m.text().slice(0, 400)));
await page.goto("http://localhost:5011", { waitUntil: "domcontentloaded" });
const result = await page.evaluate(async () => {
  try {
    const dir = new URL("occt/", document.baseURI).href;
    const mod = await import(dir + "occt-box.js");
    const oc = await mod.default({
      locateFile: (p) => (p.endsWith(".wasm") || p.endsWith(".worker.js") ? dir + p : p),
    });
    return { ok: true, hasBox: typeof oc.BRepPrimAPI_MakeBox_4, isolated: window.crossOriginIsolated };
  } catch (e) {
    return { ok: false, message: String(e && e.message || e).slice(0, 400), stack: String(e && e.stack || "").slice(0, 400) };
  }
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
