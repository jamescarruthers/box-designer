import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
await page.goto("http://localhost:5011", { waitUntil: "domcontentloaded" });
console.log(JSON.stringify(await page.evaluate(async () => {
  const dir = new URL("occt/", document.baseURI).href;
  const oc = await (await import(dir + "occt-box.js")).default({
    locateFile: (p) => (p.endsWith(".wasm") || p.endsWith(".worker.js") ? dir + p : p) });
  const names = ["GeomAbs_Shape", "TopTools_IndexedDataMapOfShapeListOfShape_1", "BRep_Builder",
    "TopoDS_Compound", "GProp_GProps_1", "BRepGProp", "GCPnts_QuasiUniformDeflection_4",
    "BRepAdaptor_Curve_2", "Handle_HLRBRep_Algo_2", "TopTools_IndexedMapOfShape_1", "TopExp",
    "BRepBuilderAPI_MakeShape", "Standard_Transient", "HLRBRep_Algo_1", "HLRBRep_HLRToShape",
    "BRepFilletAPI_MakeFillet", "HLRAlgo_Projector_2", "gp_Ax2_2"];
  const present = Object.fromEntries(names.map((n) => [n, typeof oc[n]]));
  // Try the actual failing call.
  let err = null;
  const steps = [];
  try {
    const box = new oc.BRepPrimAPI_MakeBox_4(new oc.gp_Pnt_3(0,0,0), new oc.gp_Pnt_3(10,20,30)).Shape();
    steps.push("box");
    const map = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(box, oc.TopAbs_ShapeEnum.TopAbs_EDGE, map);
    const e = oc.TopoDS.Edge_1(map.FindKey(1));
    steps.push("edge");
    const c = new oc.BRepAdaptor_Curve_2(e);
    steps.push("curve");
    new oc.GCPnts_QuasiUniformDeflection_4(c, 0.05, c.FirstParameter(), c.LastParameter(), oc.GeomAbs_Shape.GeomAbs_C1);
    steps.push("deflection");
    const algo = new oc.HLRBRep_Algo_1();
    algo.Add_2(box, 0);
    algo.Projector_1(new oc.HLRAlgo_Projector_2(new oc.gp_Ax2_2(new oc.gp_Pnt_3(0,0,0), new oc.gp_Dir_4(0,-1,0), new oc.gp_Dir_4(1,0,0))));
    algo.Update(); algo.Hide_1();
    steps.push("hlr");
    const to = new oc.HLRBRep_HLRToShape(new oc.Handle_HLRBRep_Algo_2(algo));
    to.VCompound_1();
    steps.push("extract");
  } catch (e) { err = String(e && e.message || e).slice(0, 200); }
  return { present, steps, err };
}), null, 1));
await browser.close();
