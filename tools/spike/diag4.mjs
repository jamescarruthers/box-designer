import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
await page.goto("http://localhost:5011", { waitUntil: "domcontentloaded" });
console.log(JSON.stringify(await page.evaluate(async () => {
  const dir = new URL("occt/", document.baseURI).href;
  const oc = await (await import(dir + "occt-box.js")).default({
    locateFile: (p) => (p.endsWith(".wasm") || p.endsWith(".worker.js") ? dir + p : p) });
  const steps = [];
  const decode = (e) => {
    if (typeof e === "number" && oc.getExceptionMessage) { try { return oc.getExceptionMessage(e); } catch { /* */ } }
    return String(e && e.message || e);
  };
  const present = Object.fromEntries(["BRepMesh_IncrementalMesh_2", "TopLoc_Location_1", "BRep_Tool",
    "Poly_Triangulation", "Poly_Triangle", "Handle_Poly_Triangulation", "gp_Trsf_1", "Poly_MeshPurpose",
    "getExceptionMessage"].map((n) => [n, typeof oc[n]]));
  try {
    const box = new oc.BRepPrimAPI_MakeBox_4(new oc.gp_Pnt_3(0,0,0), new oc.gp_Pnt_3(10,20,30)).Shape();
    steps.push("box");
    new oc.BRepMesh_IncrementalMesh_2(box, 0.25, false, 0.3, false);
    steps.push("mesh");
    const ex = new oc.TopExp_Explorer_2(box, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    const face = oc.TopoDS.Face_1(ex.Current());
    steps.push("face");
    const loc = new oc.TopLoc_Location_1();
    steps.push("location");
    const h = oc.BRep_Tool.Triangulation(face, loc, 0);
    steps.push("triangulation");
    const poly = h.get();
    steps.push(`nodes=${poly.NbNodes()} tris=${poly.NbTriangles()}`);
    const t = loc.Transformation();
    steps.push("trsf");
    const p = poly.Node(1).Transformed(t);
    steps.push(`node1=${p.X()},${p.Y()},${p.Z()}`);
    steps.push(`tri1=${poly.Triangle(1).Value(1)}`);
  } catch (e) { return { present, steps, err: decode(e) }; }
  return { present, steps, err: null };
}), null, 1));
await browser.close();
