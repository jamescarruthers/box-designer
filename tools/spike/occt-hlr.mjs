// Spike: does OCCT give us the §6.4 fillet-tangency distinction for free?
import initOpenCascade from "opencascade.js/dist/node.js";

const oc = await initOpenCascade();
const t = (label) => { const n = Date.now(); return () => console.log(`  ${label}: ${Date.now() - n} ms`); };

function filletedBox(dx, dy, dz, radius) {
  const box = new oc.BRepPrimAPI_MakeBox_3(new oc.gp_Pnt_3(0, 0, 0), dx, dy, dz).Shape();
  if (!radius) return box;
  const mk = new oc.BRepFilletAPI_MakeFillet(box, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  const exp = new oc.TopExp_Explorer_2(box, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let n = 0;
  while (exp.More()) { mk.Add_2(radius, oc.TopoDS.Edge_1(exp.Current())); n++; exp.Next(); }
  console.log(`  filleted ${n} edges at R${radius}`);
  return mk.Shape();
}

function countEdges(shape) {
  let n = 0;
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while (exp.More()) { n++; exp.Next(); }
  return n;
}

/** Project along -z with x to the right: the front elevation. */
function hlr(shape, eye) {
  const ax2 = new oc.gp_Ax2_3(new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Dir_4(...eye));
  const algo = new oc.HLRBRep_Algo_1();
  algo.Add_2(shape, 0);
  algo.Projector_1(new oc.HLRAlgo_Projector_2(ax2));
  algo.Update();
  algo.Hide_1 ? algo.Hide_1() : algo.Hide();
  const to = new oc.HLRBRep_HLRToShape(new oc.Handle_HLRBRep_Algo_2(algo));
  return {
    visibleSharp: countEdges(to.VCompound_1()),
    visibleSmooth: countEdges(to.Rg1LineVCompound_1()),
    visibleOutline: countEdges(to.OutLineVCompound_1()),
    hiddenSharp: countEdges(to.HCompound_1()),
    hiddenSmooth: countEdges(to.Rg1LineHCompound_1()),
    hiddenOutline: countEdges(to.OutLineHCompound_1()),
  };
}

for (const R of [0, 12]) {
  console.log(`\n=== 236 x 286 x 356 box, ${R ? `fillet R${R}` : "square edges"} ===`);
  let done = t("build");
  const shape = filletedBox(236, 286, 356, R);
  done();
  done = t("HLR (front elevation)");
  const r = hlr(shape, [0, -1, 0]);
  done();
  console.log(" ", JSON.stringify(r));
}
