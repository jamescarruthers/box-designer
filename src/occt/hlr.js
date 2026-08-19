// §6.3/§6.4 Hidden line removal through HLRBRep.
//
// The payoff over the analytic engine is the classification: OCCT separates
// sharp edges from smooth (tangential) ones, so the ISO 128 rule that a fillet
// gets no tangent line falls out of choosing which compounds to draw rather
// than being hand-coded. Silhouettes come out too, which is what a fillet
// actually shows in the isometric — §10's standing gap.

/**
 * View direction and the axes it lands on, calibrated against a 100 × 200 × 400
 * box: OCCT projects onto the Ax2's XY plane looking down its Z.
 */
export const VIEW_AXES = {
  front: { dir: [0, -1, 0], xdir: [1, 0, 0], h: (X, E) => X, v: (Y, E) => E.z - Y },
  end:   { dir: [-1, 0, 0], xdir: [0, 1, 0], h: (X, E) => E.y - X, v: (Y, E) => E.z + Y },
  plan:  { dir: [0, 0, 1], xdir: [1, 0, 0], h: (X, E) => X, v: (Y, E) => E.y - Y },
};

/** Chord height for flattening a curved projected edge, in millimetres. */
export const DEFLECTION = 0.05;

function polyline(oc, edge, map, E) {
  const c = new oc.BRepAdaptor_Curve_2(edge);
  const d = new oc.GCPnts_QuasiUniformDeflection_4(
    c, DEFLECTION, c.FirstParameter(), c.LastParameter(), oc.GeomAbs_Shape.GeomAbs_C1);
  const pts = [];
  const n = d.IsDone() ? d.NbPoints() : 2;
  for (let i = 1; i <= n; i++) {
    const p = d.IsDone() ? d.Value(i) : c.Value(i === 1 ? c.FirstParameter() : c.LastParameter());
    pts.push([map.h(p.X(), E), map.v(p.Y(), E)]);
  }
  return pts;
}

function collect(oc, compound, map, E) {
  const out = [];
  const exp = new oc.TopExp_Explorer_2(compound, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while (exp.More()) {
    out.push(polyline(oc, oc.TopoDS.Edge_1(exp.Current()), map, E));
    exp.Next();
  }
  return out;
}

/**
 * Run HLR for one view. Returns each class separately so the caller decides
 * what a drawing standard wants drawn.
 */
export function hiddenLineRemoval(oc, shape, view, E) {
  const map = VIEW_AXES[view];
  const ax2 = new oc.gp_Ax2_2(new oc.gp_Pnt_3(0, 0, 0),
    new oc.gp_Dir_4(...map.dir), new oc.gp_Dir_4(...map.xdir));

  const algo = new oc.HLRBRep_Algo_1();
  algo.Add_2(shape, 0);
  algo.Projector_1(new oc.HLRAlgo_Projector_2(ax2));
  algo.Update();
  algo.Hide_1();
  const to = new oc.HLRBRep_HLRToShape(new oc.Handle_HLRBRep_Algo_2(algo));

  return {
    sharpVisible: collect(oc, to.VCompound_1(), map, E),
    outlineVisible: collect(oc, to.OutLineVCompound_1(), map, E),
    smoothVisible: collect(oc, to.Rg1LineVCompound_1(), map, E),
    sharpHidden: collect(oc, to.HCompound_1(), map, E),
    outlineHidden: collect(oc, to.OutLineHCompound_1(), map, E),
    smoothHidden: collect(oc, to.Rg1LineHCompound_1(), map, E),
  };
}

/**
 * §6.4 What ISO 128 draws: sharp edges and silhouettes, visible solid and
 * hidden dashed. Smooth edges are omitted — a fillet meets the flat face
 * tangentially, so there is no line there.
 *
 * Shaped to match what `buildOrthoView` returns, so the sheet renderer of §6.1
 * takes either engine without knowing which produced it.
 */
export function viewGeometry(oc, shape, view, E, { tangentEdges = false } = {}) {
  const r = hiddenLineRemoval(oc, shape, view, E);
  const lines = [];
  const push = (polys, visible, kind) => {
    for (const p of polys) {
      for (let i = 0; i + 1 < p.length; i++) lines.push({ a: p[i], b: p[i + 1], visible, kind });
    }
  };
  push(r.sharpVisible, true, "hlr");
  push(r.outlineVisible, true, "silhouette");
  push(r.sharpHidden, false, "hlr");
  push(r.outlineHidden, false, "silhouette");
  if (tangentEdges) {
    push(r.smoothVisible, true, "tangent");
    push(r.smoothHidden, false, "tangent");
  }
  return { view, lines, arcs: [], classes: r };
}
