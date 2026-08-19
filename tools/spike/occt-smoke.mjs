import initOpenCascade from "opencascade.js/dist/node.js";
const t0 = Date.now();
const oc = await initOpenCascade();
console.log("loaded in", Date.now() - t0, "ms");
const names = ["BRepPrimAPI_MakeBox_2", "BRepFilletAPI_MakeFillet", "BRepFilletAPI_MakeChamfer",
  "HLRBRep_Algo", "HLRBRep_PolyAlgo", "HLRBRep_HLRToShape", "HLRAlgo_Projector",
  "BRepAlgoAPI_Common", "BRepAlgoAPI_Cut", "BRepAlgoAPI_Fuse",
  "TopExp_Explorer", "BRepMesh_IncrementalMesh", "BRepGProp", "GProp_GProps"];
for (const n of names) console.log(String(typeof oc[n]).padEnd(10), n);
