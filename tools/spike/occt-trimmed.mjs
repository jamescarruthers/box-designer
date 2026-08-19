// Verify the trimmed build does everything the full one did for us.
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
globalThis.__dirname = dirname(fileURLToPath(import.meta.url));
globalThis.require = createRequire(import.meta.url);

const here = join(dirname(fileURLToPath(import.meta.url)), "../../occt");
const { default: Factory } = await import(join(here, "occt-box.js"));
const t0 = Date.now();
const oc = await new Factory({
  locateFile: (p) => (p.endsWith(".wasm") ? join(here, "occt-box.wasm")
    : p.endsWith(".worker.js") ? join(here, "occt-box.worker.js") : p),
});
console.log("trimmed kernel loaded in", Date.now() - t0, "ms");

const missing = ["BRepPrimAPI_MakeBox_4", "BRepFilletAPI_MakeFillet", "BRepFilletAPI_MakeChamfer",
  "HLRBRep_Algo_1", "HLRBRep_HLRToShape", "HLRAlgo_Projector_2", "BRepAlgoAPI_Common",
  "BRepAlgoAPI_Cut", "TopExp_Explorer_2", "TopoDS", "BRepAdaptor_Curve_2",
  "GCPnts_QuasiUniformDeflection_4", "BRepGProp", "GProp_GProps_1", "BRep_Builder",
  "TopoDS_Compound", "gp_Ax2_2", "gp_Dir_4", "gp_Pnt_3", "TopTools_IndexedMapOfShape_1",
  "BRepPrimAPI_MakeHalfSpace", "BRepMesh_IncrementalMesh_2",
].filter((n) => typeof oc[n] !== "function");
console.log("missing symbols:", missing.length ? missing.join(", ") : "none");

const { solve } = await import("../../src/model/solver.js");
const { uniformEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels } = await import("../../src/model/bevel.js");
const { assembly, volumeOf } = await import("../../src/occt/solids.js");
const { hiddenLineRemoval } = await import("../../src/occt/hlr.js");

const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
  order: ["front", "back", "left", "right", "top", "bottom"] });
const owners = edgeOwners(sol.env, sol.panels);
const edges = applicableEdges(uniformEdges("fillet", 12), fullLengthEdges(sol.env, sol.panels, owners));
const shape = assembly(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners));
console.log("filleted assembly volume:", (volumeOf(oc, shape) / 1e3).toFixed(1), "cm3");
const r = hiddenLineRemoval(oc, shape, "front", sol.E);
console.log("front view: sharpV", r.sharpVisible.length, "smoothV", r.smoothVisible.length,
  "sharpH", r.sharpHidden.length, "smoothH", r.smoothHidden.length);
