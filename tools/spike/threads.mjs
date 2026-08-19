// What do the pre-allocated pthreads actually buy?
//
// The answer that set PTHREAD_POOL_SIZE in occt/box-designer.yml. Run it
// against a preview server before changing that number:
//
//   npx vite build && npx vite preview --port 5011 &
//   node tools/spike/threads.mjs
//
// Only BRepMesh takes an isInParallel flag. HLRBRep has no parallel mode at
// all, and HLR is the dominant cost of the sheet — so no thread count can
// touch the expensive half of the pipeline.

import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://localhost:5011";
const REPS = 5;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

const result = await page.evaluate(async (reps) => {
  const dir = new URL("occt/", document.baseURI).href;
  const workers = () => performance.getEntriesByType("resource").filter((r) => r.name.includes("worker")).length;
  const before = workers();
  const oc = await (await import(dir + "occt-box.js")).default({
    locateFile: (p) => (p.endsWith(".wasm") || p.endsWith(".worker.js") ? dir + p : p),
  });

  /** Six filleted panels: a carcass-sized job. */
  const panels = () => {
    const out = [];
    for (let i = 0; i < 6; i++) {
      const box = new oc.BRepPrimAPI_MakeBox_4(new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Pnt_3(236, 18, 356)).Shape();
      const mk = new oc.BRepFilletAPI_MakeFillet(box, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const map = new oc.TopTools_IndexedMapOfShape_1();
      oc.TopExp.MapShapes_1(box, oc.TopAbs_ShapeEnum.TopAbs_EDGE, map);
      for (let e = 1; e <= 4; e++) mk.Add_2(12, oc.TopoDS.Edge_1(map.FindKey(e)));
      out.push(mk.Shape());
    }
    return out;
  };

  const compound = (shapes) => {
    const b = new oc.BRep_Builder(), c = new oc.TopoDS_Compound();
    b.MakeCompound(c);
    for (const s of shapes) b.Add(c, s);
    return c;
  };

  const mesh = (shape, parallel) => new oc.BRepMesh_IncrementalMesh_2(shape, 0.25, false, 0.3, parallel);

  const median = (run) => {
    const t = [];
    for (let r = 0; r < reps; r++) {
      const shapes = panels();
      const t0 = performance.now();
      run(shapes);
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    return Math.round(t[Math.floor(t.length / 2)]);
  };

  return {
    hardwareConcurrency: navigator.hardwareConcurrency,
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    workersSpawned: workers() - before,
    meshing: {
      perShapeSerial: median((s) => s.forEach((x) => mesh(x, false))),
      perShapeParallel: median((s) => s.forEach((x) => mesh(x, true))),
      compoundSerial: median((s) => mesh(compound(s), false)),
      compoundParallel: median((s) => mesh(compound(s), true)),
    },
  };
}, REPS);

console.log(JSON.stringify(result, null, 1));

const m = result.meshing;
console.log(`\nparallel meshing saves ${Math.round((1 - m.perShapeParallel / m.perShapeSerial) * 100)}% of the mesh step`);
console.log(`batching into one compound adds ${m.perShapeParallel - m.compoundParallel} ms on top — i.e. nothing`);
await browser.close();
