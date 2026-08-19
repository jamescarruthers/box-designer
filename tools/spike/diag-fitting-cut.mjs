// Does the rebuilt kernel actually cut a driver out of a panel?
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await b.newPage();
await page.goto("http://localhost:5011", { waitUntil: "networkidle" });
console.log(JSON.stringify(await page.evaluate(async () => {
  const dir = new URL("occt/", document.baseURI).href;
  const oc = await (await import(dir + "occt-box.js")).default({
    locateFile: (p) => (p.endsWith(".wasm") || p.endsWith(".worker.js") ? dir + p : p) });

  const volume = (shape) => {
    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
    return props.Mass();
  };
  const faces = (shape) => {
    let n = 0;
    const e = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (e.More()) { n++; e.Next(); }
    return n;
  };

  try {
    // A 236 x 18 x 356 baffle.
    const panel = new oc.BRepPrimAPI_MakeBox_4(new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Pnt_3(236, 18, 356)).Shape();
    const before = { volume: volume(panel), faces: faces(panel) };

    // A 116 mm cutout on the face normal, started clear of both faces.
    const axis = new oc.gp_Ax2_3(new oc.gp_Pnt_3(118, -1, 240), new oc.gp_Dir_4(0, 1, 0));
    const cyl = new oc.BRepPrimAPI_MakeCylinder_3(axis, 58, 20).Shape();
    const cut = new oc.BRepAlgoAPI_Cut_3(panel, cyl, new oc.Message_ProgressRange_1()).Shape();
    const after = { volume: volume(cut), faces: faces(cut) };

    return {
      ok: true, before, after,
      removed: Math.round(before.volume - after.volume),
      expected: Math.round(Math.PI * 58 * 58 * 18),
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 200) };
  }
}), null, 1));
await b.close();
