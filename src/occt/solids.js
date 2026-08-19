// Panel solids as B-Rep, built from the analytic solver's boxes.
//
// The solver of §2 stays the source of truth for panel sizes: it is exact
// integer arithmetic and the cut list depends on it. OCCT is handed the
// finished boxes and asked for the things a kernel is better at — real
// fillets, hidden line removal that knows a tangential edge from a sharp one,
// and booleans for sections and, later, cutouts.

import { AXIS, PAIR, AXES, edgeKey } from "../model/constants.js";

/** Every distinct edge of a shape, deduped: the explorer visits each one per face. */
export function edgesOf(oc, shape) {
  const map = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, map);
  const out = [];
  for (let i = 1; i <= map.Extent(); i++) out.push(oc.TopoDS.Edge_1(map.FindKey(i)));
  return out;
}

const mid = (c) => (c.FirstParameter() + c.LastParameter()) / 2;

/** Where an edge sits, and which way it runs — enough to match it to a face pair. */
export function edgeMidpoint(oc, edge) {
  const c = new oc.BRepAdaptor_Curve_2(edge);
  const p = c.Value(mid(c));
  const a = c.Value(c.FirstParameter()), b = c.Value(c.LastParameter());
  return {
    point: { x: p.X(), y: p.Y(), z: p.Z() },
    run: { x: Math.abs(b.X() - a.X()), y: Math.abs(b.Y() - a.Y()), z: Math.abs(b.Z() - a.Z()) },
  };
}

const NEAR = 1e-7;

/**
 * Which of a panel's own faces an edge lies on. A box edge lies on exactly two.
 * Returned as the same `front|top` keys the rest of the app uses.
 */
export function edgeFaces(box, m) {
  const on = [];
  for (const b of AXES) {
    const [lo, hi] = PAIR[b];
    if (Math.abs(m.point[b] - box[b][0]) < NEAR) on.push(lo);
    else if (Math.abs(m.point[b] - box[b][1]) < NEAR) on.push(hi);
  }
  return on;
}

/** A panel as a plain box solid, in model coordinates. */
export function panelBox(oc, panel) {
  const b = panel.box;
  return new oc.BRepPrimAPI_MakeBox_4(
    new oc.gp_Pnt_3(b.x[0], b.y[0], b.z[0]),
    new oc.gp_Pnt_3(b.x[1], b.y[1], b.z[1]),
  ).Shape();
}

/**
 * §3 A panel solid with its bevels cut from the outer face.
 * `bevels` is keyed by the panel's own side face, as `panelBevels` returns it —
 * so the edge treatment lands on exactly the edges the analytic model says it
 * should, and OCCT is left to make the surface rather than decide the joinery.
 */
export function panelSolid(oc, panel, bevels = {}) {
  const shape = panelBox(oc, panel);
  const wanted = Object.entries(bevels).filter(([, t]) => t && t.type !== "none" && t.radius > 0);
  if (!wanted.length) return shape;

  const own = AXIS[panel.face][0];
  const byKind = { fillet: [], chamfer: [] };
  for (const edge of edgesOf(oc, shape)) {
    const m = edgeMidpoint(oc, edge);
    // An edge of this panel's outer profile lies on one of its side faces and
    // runs along neither the thickness axis nor that face's normal.
    for (const [side, t] of wanted) {
      const [sideAxis] = AXIS[side];
      if (sideAxis === own) continue;
      const faces = edgeFaces(panel.box, m);
      if (!faces.includes(side)) continue;
      // Take only the edge on the outer surface, not its twin on the inner one.
      const [, s] = AXIS[panel.face];
      const outer = s < 0 ? panel.box[own][0] : panel.box[own][1];
      if (Math.abs(m.point[own] - outer) > NEAR) continue;
      byKind[t.type].push({ edge, radius: t.radius });
      break;
    }
  }

  let result = shape;
  if (byKind.fillet.length) {
    const mk = new oc.BRepFilletAPI_MakeFillet(result, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    for (const { edge, radius } of byKind.fillet) mk.Add_2(radius, edge);
    result = mk.Shape();
  }
  if (byKind.chamfer.length) {
    const mk = new oc.BRepFilletAPI_MakeChamfer(result);
    for (const { edge, radius } of byKind.chamfer) mk.Add_2(radius, radius, edge, firstFaceOf(oc, result, edge));
    result = mk.Shape();
  }
  return result;
}

function firstFaceOf(oc, shape, edge) {
  const faces = new oc.TopTools_IndexedDataMapOfShapeListOfShape_1();
  oc.TopExp.MapShapesAndAncestors(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_FACE, faces);
  const i = faces.FindIndex(edge);
  return oc.TopoDS.Face_1(faces.FindFromIndex(i).First_1());
}

/** All the panels as one compound, which is what HLR wants. */
export function assembly(oc, panels, bevelsFor) {
  const builder = new oc.BRep_Builder();
  const comp = new oc.TopoDS_Compound();
  builder.MakeCompound(comp);
  for (let i = 0; i < panels.length; i++) {
    builder.Add(comp, panelSolid(oc, panels[i], bevelsFor(i, panels[i])));
  }
  return comp;
}

/** §2.4 The kernel's own volume, so closure can be checked against it. */
export function volumeOf(oc, shape) {
  const props = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  return props.Mass();
}
