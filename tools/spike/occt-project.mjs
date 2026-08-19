// Calibrate the HLR projector: which model axes land on the view's h and v.
import initOpenCascade from "opencascade.js/dist/node.js";
const oc = await initOpenCascade();

const E = { x: 100, y: 200, z: 400 };            // deliberately unequal
const shape = new oc.BRepPrimAPI_MakeBox_3(new oc.gp_Pnt_3(0, 0, 0), E.x, E.y, E.z).Shape();

function project(dirVec, xDirVec) {
  const ax2 = new oc.gp_Ax2_2(new oc.gp_Pnt_3(0, 0, 0),
    new oc.gp_Dir_4(...dirVec), new oc.gp_Dir_4(...xDirVec));
  const algo = new oc.HLRBRep_Algo_1();
  algo.Add_2(shape, 0);
  algo.Projector_1(new oc.HLRAlgo_Projector_2(ax2));
  algo.Update();
  algo.Hide_1();
  const to = new oc.HLRBRep_HLRToShape(new oc.Handle_HLRBRep_Algo_2(algo));
  return bounds(to.VCompound_1());
}

function bounds(comp) {
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity], n = 0;
  const exp = new oc.TopExp_Explorer_2(comp, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while (exp.More()) {
    const c = new oc.BRepAdaptor_Curve_2(oc.TopoDS.Edge_1(exp.Current()));
    for (const u of [c.FirstParameter(), c.LastParameter()]) {
      const p = c.Value(u);
      lo = [Math.min(lo[0], p.X()), Math.min(lo[1], p.Y())];
      hi = [Math.max(hi[0], p.X()), Math.max(hi[1], p.Y())];
    }
    n++; exp.Next();
  }
  return { edges: n, x: [lo[0], hi[0]], y: [lo[1], hi[1]] };
}

console.log("box", E);
console.log("dir 0,-1,0 xdir 1,0,0 (front?) ", JSON.stringify(project([0, -1, 0], [1, 0, 0])));
console.log("dir 0, 1,0 xdir 1,0,0         ", JSON.stringify(project([0, 1, 0], [1, 0, 0])));
console.log("dir -1,0,0 xdir 0,1,0 (end?)  ", JSON.stringify(project([-1, 0, 0], [0, 1, 0])));
console.log("dir 0,0,1 xdir 1,0,0 (plan?)  ", JSON.stringify(project([0, 0, 1], [1, 0, 0])));
