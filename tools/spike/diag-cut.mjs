import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage();
await page.goto("http://localhost:5011", { waitUntil: "domcontentloaded" });
console.log(JSON.stringify(await page.evaluate(async () => {
  const dir = new URL("occt/", document.baseURI).href;
  const oc = await (await import(dir + "occt-box.js")).default({
    locateFile: (p) => (p.endsWith(".wasm") || p.endsWith(".worker.js") ? dir + p : p) });
  const have = Object.fromEntries(["Message_ProgressRange", "Message_ProgressRange_1",
    "BRepAlgoAPI_Cut_1", "BRepAlgoAPI_Cut_3", "BRepPrimAPI_MakeCylinder_3"].map((n) => [n, typeof oc[n]]));
  // Can a cut be done without a progress range, via the default ctor + Build?
  let viaDefault = null;
  try {
    const box = new oc.BRepPrimAPI_MakeBox_4(new oc.gp_Pnt_3(0,0,0), new oc.gp_Pnt_3(50,20,50)).Shape();
    const cyl = new oc.BRepPrimAPI_MakeCylinder_3(
      new oc.gp_Ax2_3(new oc.gp_Pnt_3(25,-1,25), new oc.gp_Dir_4(0,1,0)), 8, 30).Shape();
    const cut = new oc.BRepAlgoAPI_Cut_1();
    const a = new oc.TopTools_ListOfShape_1(); a.Append_1(box);
    const t = new oc.TopTools_ListOfShape_1(); t.Append_1(cyl);
    cut.SetArguments(a); cut.SetTools(t); cut.Build(new oc.Message_ProgressRange_1());
    viaDefault = "built";
  } catch (e) { viaDefault = "failed: " + String(e && e.message || e).slice(0, 90); }
  return { have, viaDefault };
}), null, 1));
await b.close();
