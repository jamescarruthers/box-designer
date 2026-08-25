// Panel solids as B-Rep, built from the analytic solver's boxes.
//
// The solver of §2 stays the source of truth for panel sizes: it is exact
// integer arithmetic and the cut list depends on it. OCCT is handed the
// finished boxes and asked for the things a kernel is better at — real
// fillets, hidden line removal that knows a tangential edge from a sharp one,
// and booleans for sections and, later, cutouts.

import { AXIS, PAIR, AXES, edgeKey } from "../model/constants.js";
import { fittingCircles, faceAxes, portOuterRadius, cutoutFlare } from "../model/fittings.js";

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
/**
 * §42 The grooves a rebate cuts, taken out of the panel.
 *
 * The kernel needs no cell decomposition — the notches are boxes and a boolean
 * cut is what a boolean cut is for. Overlapping notches cut the same material
 * twice, which costs nothing and removes it once.
 */
export function cutNotches(oc, shape, panel) {
  let result = shape;
  for (const n of panel.notches ?? []) {
    const tool = new oc.BRepPrimAPI_MakeBox_4(
      new oc.gp_Pnt_3(n.x[0], n.y[0], n.z[0]),
      new oc.gp_Pnt_3(n.x[1], n.y[1], n.z[1])).Shape();
    result = new oc.BRepAlgoAPI_Cut_3(result, tool, new oc.Message_ProgressRange_1()).Shape();
  }
  return result;
}

export function panelSolid(oc, panel, bevels = {}, fittings = []) {
  // §42 Before the bevels: a groove in the inner face and a round on an outer
  // edge do not meet, and cutting the box down first gives the fillet less
  // shape to chew on.
  const shape = cutNotches(oc, panelBox(oc, panel), panel);
  const all = Object.entries(bevels).filter(([, t]) => t && t.type !== "none" && t.radius > 0);
  const mitres = all.filter(([, t]) => t.type === "mitre");
  const wanted = all.filter(([, t]) => t.type !== "mitre");
  if (!wanted.length) {
    const cut = cutMitres(oc, shape, panel, mitres);
    return fittings.length ? cutFittings(oc, cut, panel, fittings) : cut;
  }

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
    // Add_2 is the symmetric one: equal legs, no face argument. The four-argument
    // overload is Add_3, and calling it under the wrong name is a binding error
    // at the first chamfer rather than anything the geometry would explain.
    for (const { edge, radius } of byKind.chamfer) mk.Add_2(radius, edge);
    result = mk.Shape();
  }
  result = cutMitres(oc, result, panel, mitres);
  return fittings.length ? cutFittings(oc, result, panel, fittings) : result;
}

const vec = (axis, s) => ({ x: axis === "x" ? s : 0, y: axis === "y" ? s : 0, z: axis === "z" ? s : 0 });
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x,
});

/**
 * §12 The tool that cuts one mitre: a box turned 45° about the outer corner.
 *
 * Not a chamfer. A mitre's leg is the panel's whole thickness, so chamfering
 * the inner edge would have to consume the entire side face — the face
 * disappears, and BRepFilletAPI is entitled to refuse. A boolean against a
 * rotated box asks nothing awkward.
 *
 * Measure u inward from the outer face and v inward from the mitred side, both
 * zero on the corner line. The material to remove is u > v. Start with the
 * quadrant u ≥ 0, v ≤ 0 — a box hanging off the side of the panel, in free air
 * — and turn it 45° about the corner line, from u toward v. It sweeps to
 * −45°…+45°, whose half inside the panel is exactly u > v. The plane v = 0 ends
 * up in the tool's interior rather than on its boundary, so the cut never has
 * to decide about a face lying in the panel's own side.
 */
export function mitreTool(oc, panel, side, leg) {
  const [oa, os] = AXIS[panel.face];
  const [sa, ss] = AXIS[side];
  const run = AXES.find((b) => b !== oa && b !== sa);
  const outer = os < 0 ? panel.box[oa][0] : panel.box[oa][1];
  const face = ss < 0 ? panel.box[sa][0] : panel.box[sa][1];
  const du = -os, dv = -ss;                      // inward, from each of the two faces
  const K = 4 * leg;                             // comfortably past the corner square

  const lo = {}, hi = {};
  lo[oa] = Math.min(outer, outer + du * K); hi[oa] = Math.max(outer, outer + du * K);
  lo[sa] = Math.min(face, face - dv * K);   hi[sa] = Math.max(face, face - dv * K);
  lo[run] = panel.box[run][0] - 1;          hi[run] = panel.box[run][1] + 1;

  const box = new oc.BRepPrimAPI_MakeBox_4(
    new oc.gp_Pnt_3(lo.x, lo.y, lo.z), new oc.gp_Pnt_3(hi.x, hi.y, hi.z)).Shape();

  const axis = cross3(vec(oa, du), vec(sa, dv));
  const corner = { [oa]: outer, [sa]: face, [run]: panel.box[run][0] };
  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(
    new oc.gp_Ax1_2(new oc.gp_Pnt_3(corner.x, corner.y, corner.z),
      new oc.gp_Dir_4(axis.x, axis.y, axis.z)),
    Math.PI / 4);
  return new oc.BRepBuilderAPI_Transform_2(box, trsf, true).Shape();
}

/** §12 Every mitre on one panel, cut in turn. */
export function cutMitres(oc, shape, panel, mitres) {
  let result = shape;
  for (const [side, t] of mitres) {
    result = new oc.BRepAlgoAPI_Cut_3(
      result, mitreTool(oc, panel, side, t.radius), new oc.Message_ProgressRange_1()).Shape();
  }
  return result;
}

/** A cylinder on a face's normal, started clear of the panel so the cut is clean. */
function bore(oc, panel, face, at, radius, { from = "outer", length, overshoot = 1 } = {}) {
  const [a, s] = AXIS[face];
  const [p, q] = faceAxes(face);
  const outer = s < 0 ? panel.box[a][0] : panel.box[a][1];
  const inner = s < 0 ? panel.box[a][1] : panel.box[a][0];
  const thickness = Math.abs(panel.box[a][1] - panel.box[a][0]);

  const start = {};
  start[p] = at.a;
  start[q] = at.b;
  start[a] = from === "outer" ? outer + s * overshoot : inner;
  // §36 A bore from the outer face runs right through unless it is given a
  // depth: a blind hole is drilled from the face somebody drills from, so the
  // overshoot at the entry is added to the depth rather than to both ends.
  const height = from === "inner" ? length
    : Number.isFinite(length) ? length + overshoot
      : thickness + 2 * overshoot;

  const axis = new oc.gp_Ax2_3(
    new oc.gp_Pnt_3(start.x, start.y, start.z),
    new oc.gp_Dir_4(a === "x" ? -s : 0, a === "y" ? -s : 0, a === "z" ? -s : 0),
  );
  return new oc.BRepPrimAPI_MakeCylinder_3(axis, radius, height).Shape();
}

/**
 * §10 Drivers and ports, cut for real.
 *
 * Every hole is a cylinder started a millimetre clear of the outer face and run
 * a millimetre past the inner one: a cut that lands exactly on a face leaves
 * coincident surfaces, and the boolean then has to decide something it should
 * never have been asked.
 */
export function cutFittings(oc, shape, panel, fittings) {
  let result = shape;
  const cut = (shape_, tool) =>
    new oc.BRepAlgoAPI_Cut_3(shape_, tool, new oc.Message_ProgressRange_1()).Shape();
  for (const f of fittings) {
    const circles = fittingCircles(f).filter((c) => c.d > 0);
    // §36 The order is the whole reason a flare may now run into the bolt
    // holes. §29 cut every hole and then filleted, and OCCT refuses to run a
    // fillet whose sweep crosses holes that are already there — which is what
    // capped the radius short of the bolt circle. Cut the cutout, flare it
    // while the face around it is still solid, and drill the bolts through the
    // flared surface afterwards: every radius up to the thickness builds, and
    // the bolt holes come out as ovals on the slope, which is what a drill
    // through a routed flare actually leaves.
    for (const c of circles.filter((x) => x.role !== "bolt")) {
      result = cut(result, bore(oc, panel, f.face, c.at, c.d / 2));
    }
    const flare = cutoutFlare(f);
    if (flare) result = flareCutout(oc, result, panel, f, flare);
    for (const c of circles.filter((x) => x.role === "bolt")) {
      // §36 A depth makes it a blind hole — for a screw or an insert, drilled
      // from the mounting face and stopping in the material.
      result = cut(result, bore(oc, panel, f.face, c.at, c.d / 2, { length: c.deep }));
    }
  }
  return result;
}

/**
 * §29 The circular edges where a cutout breaks through the inner face.
 *
 * Found by where they lie rather than by asking the curve what it is: a bore
 * through a solid leaves its rim as one closed circle in some builds and as two
 * half-arcs either side of the cylinder's seam in others, and both answer the
 * same geometric question — a point on the inner face, the cutout's radius from
 * its centre. Bolt holes sit at their own radius about their own centres and do
 * not match, which is the point: a flare round a clearance hole is a way of
 * losing the bolt.
 */
export function cutoutRim(oc, shape, panel, f) {
  const [a, s] = AXIS[f.face];
  const [p, q] = faceAxes(f.face);
  const inner = s < 0 ? panel.box[a][1] : panel.box[a][0];
  const radius = f.cutout / 2;
  const out = [];
  for (const edge of edgesOf(oc, shape)) {
    const m = edgeMidpoint(oc, edge);
    if (Math.abs(m.point[a] - inner) > NEAR) continue;
    const d = Math.hypot(m.point[p] - f.at.a, m.point[q] - f.at.b);
    if (Math.abs(d - radius) > 1e-6) continue;
    out.push(edge);
  }
  return out;
}

/** §29 Round or break the back of one cutout. */
export function flareCutout(oc, shape, panel, f, flare) {
  const rim = cutoutRim(oc, shape, panel, f);
  if (!rim.length) return shape;
  if (flare.type === "chamfer") {
    const mk = new oc.BRepFilletAPI_MakeChamfer(shape);
    for (const edge of rim) mk.Add_2(flare.radius, edge);
    return mk.Shape();
  }
  const mk = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  for (const edge of rim) mk.Add_2(flare.radius, edge);
  return mk.Shape();
}

/** A port tube: an annulus standing off the panel's inner face into the cavity. */
export function portTube(oc, panel, f) {
  const outer = bore(oc, panel, f.face, f.at, portOuterRadius(f), { from: "inner", length: f.length });
  const bore_ = bore(oc, panel, f.face, f.at, f.diameter / 2, { from: "inner", length: f.length + 2 });
  return new oc.BRepAlgoAPI_Cut_3(outer, bore_, new oc.Message_ProgressRange_1()).Shape();
}

/**
 * All the panels as one compound, which is what HLR wants.
 *
 * `tubesFor` is separate from `fittingsFor` because a bore goes through every
 * layer of a face and a port's tube hangs off only the innermost of them. Take
 * the tubes from the fittings list and a clad, doubled panel grows three
 * concentric tubes.
 */
export function assembly(oc, panels, bevelsFor, fittingsFor = () => [], tubesFor = () => []) {
  const builder = new oc.BRep_Builder();
  const comp = new oc.TopoDS_Compound();
  builder.MakeCompound(comp);
  for (let i = 0; i < panels.length; i++) {
    builder.Add(comp, panelSolid(oc, panels[i], bevelsFor(i, panels[i]), fittingsFor(i, panels[i])));
    for (const f of tubesFor(i, panels[i])) builder.Add(comp, portTube(oc, panels[i], f));
  }
  return comp;
}

/** §2.4 The kernel's own volume, so closure can be checked against it. */
export function volumeOf(oc, shape) {
  const props = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  return props.Mass();
}
