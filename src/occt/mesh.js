// §4 Triangles for the 3D view, from the kernel.
//
// The analytic path approximates a fillet with an eight-step ring stack and
// cannot represent the blend where two fillets meet at a corner. The kernel
// meshes the real surface, so the 3D view and the drawing finally describe the
// same solid.

import { toThree } from "../three/panelGeometry.js";
import { panelSolid, portTube } from "./solids.js";
import { edgeSegments } from "./edges.js";

/** Chord height for the mesh, in millimetres. Small enough that R12 reads round. */
export const LINEAR_DEFLECTION = 0.25;
export const ANGULAR_DEFLECTION = 0.3;

/**
 * §4.4 The signed volume of a triangle mesh: (1/6) Σ a · (b × c).
 *
 * The check that a mesh is closed and consistently wound, and unlike "does
 * every normal point away from the centroid" it holds for a solid with a hole
 * in it. Positive and equal to the kernel's own volume means every face is the
 * right way round; a bore whose wall is inside out shows up as a shortfall.
 */
export function meshVolume(positions) {
  let v = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const [a, b, c] = [0, 1, 2].map((t) => positions.subarray(i + t * 3, i + t * 3 + 3));
    v += a[0] * (b[1] * c[2] - b[2] * c[1])
       - a[1] * (b[0] * c[2] - b[2] * c[0])
       + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return v / 6;
}

/**
 * Whether a face is reversed against its own surface.
 *
 * `Orientation_1` is the getter — the overloads are numbered, and the setter is
 * `Orientation_2`. Enum values arrive as objects in one build and as plain
 * numbers in another, so compare on `.value` when it is there.
 */
const isReversed = (oc, face) => {
  const o = face.Orientation_1();
  const rev = oc.TopAbs_Orientation.TopAbs_REVERSED;
  return (o?.value ?? o) === (rev?.value ?? rev);
};

/**
 * Triangulate one solid into three.js coordinates.
 *
 * Winding comes from the face's own orientation, which is the only thing that
 * knows. It used to be inferred: flip any triangle whose normal points back
 * toward the solid's centroid. That works on a convex solid and a panel was one
 * — until §10 bored a hole through it. The wall of a bore faces *inward*, at
 * the axis of the hole, so the test flipped every triangle on it and the hole
 * had no inside: you looked through the panel and saw nothing, because the only
 * surface there was pointing away from you and culled.
 *
 * `toThree` is a rotation of determinant +1, so it carries the winding across
 * unchanged.
 */
export function triangulate(oc, shape, E, {
  linear = LINEAR_DEFLECTION, angular = ANGULAR_DEFLECTION, parallel = false,
} = {}) {
  // BRepMesh is the only step in the pipeline that takes threads — HLRBRep has
  // no parallel mode — so this argument is the whole of what the pool is for.
  // Worth 18-22% of the mesh step on four cores; see tools/spike/threads.mjs.
  //
  // It defaults to off, and that is now a considered position rather than a
  // conservative one. This call is synchronous and uninterruptible: hand it a
  // pool that will not take the work and it blocks for ever, and nothing on
  // either side of it can do a thing about that. Counting the pool first is not
  // enough — emscripten lists workers it has created, not workers that loaded,
  // and on a host that cannot send COEP the nested pthread scripts are exactly
  // the ones liable to be blocked. Thirty milliseconds is not worth a wager
  // that can only be settled by hanging.
  new oc.BRepMesh_IncrementalMesh_2(shape, linear, false, angular, parallel);

  const tris = [];
  let reversed = 0;
  const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const loc = new oc.TopLoc_Location_1();
    const handle = oc.BRep_Tool.Triangulation(face, loc, 0);
    if (!handle.IsNull()) {
      const poly = handle.get();
      const trsf = loc.Transformation();
      const flip = isReversed(oc, face);
      if (flip) reversed++;
      const nodes = [];
      for (let i = 1; i <= poly.NbNodes(); i++) {
        const p = poly.Node(i).Transformed(trsf);
        nodes.push(toThree([p.X(), p.Y(), p.Z()], E));
      }
      for (let i = 1; i <= poly.NbTriangles(); i++) {
        const t = poly.Triangle(i);
        const [a, b, c] = [t.Value(1) - 1, t.Value(2) - 1, t.Value(3) - 1];
        tris.push(flip ? [nodes[a], nodes[c], nodes[b]] : [nodes[a], nodes[b], nodes[c]]);
      }
    }
    explorer.Next();
  }

  const centroid = [0, 1, 2].map((k) =>
    tris.reduce((a, t) => a + t[0][k] + t[1][k] + t[2][k], 0) / (tris.length * 3 || 1));

  const positions = new Float32Array(tris.length * 9);
  let o = 0;
  for (const t of tris) {
    for (const p of t) { positions[o++] = p[0]; positions[o++] = p[1]; positions[o++] = p[2]; }
  }
  return { positions, triangles: tris.length, reversed, centroid };
}

/**
 * Every panel, meshed, with its real edges alongside. Indices line up with
 * `sol.panels`. The edges come from the topology, not from the triangles — see
 * edges.js for why that matters at a fillet.
 */
/**
 * §25 What OCCT threw, in words.
 *
 * Emscripten throws a C++ exception as the bare pointer to it — a number, with
 * no `message` and nothing else on it. Printed straight out that reads as
 * `working: 7210856`, which tells somebody the kernel failed and nothing
 * whatever about why. The build has no exception-message helper compiled in, so
 * the number cannot be turned into the text OCCT put in it; what it can be
 * turned into is an honest sentence saying which of the two it is.
 */
const REFUSED = "the geometry engine would not build this panel";

export function describeShapeFailure(error) {
  // A number is the pointer; nothing at all is a throw with nothing on it.
  // `String(undefined)` is the word "undefined", which is truthy and useless,
  // so the nullish check has to come before the conversion rather than after.
  if (error == null || typeof error === "number") return REFUSED;
  const text = String(error.message ?? error).trim();
  return text && text !== "undefined" ? text : REFUSED;
}

export function meshPanels(oc, panels, bevelsFor, E, opts = {}) {
  const fittingsFor = opts.fittingsFor ?? (() => []);
  // Separate from the fittings: the bore goes through every layer of a face,
  // the tube hangs off the innermost one only.
  const tubesFor = opts.tubesFor ?? (() => []);
  return panels.map((panel, i) => {
    // §25 One panel at a time, and one panel's failure at a time.
    //
    // OCCT refuses shapes it cannot build — a bevel it will not run round a
    // corner is the one that turns up — and it refuses them by throwing. Thrown
    // from the whole job, that lost the whole box: six panels replaced by a
    // sentence, for one edge on one of them. Caught here, the panel that could
    // not be cut comes back marked, the other five are the kernel's own, and
    // the views already fall back to the analytic stack for anything without
    // positions (§4). What is on screen is then the box, with one panel drawn
    // the approximate way, which is a great deal better than no box.
    try {
      const on = fittingsFor(i, panel);
      const solid = panelSolid(oc, panel, bevelsFor(i, panel), on);
      const mesh = triangulate(oc, solid, E, opts);
      // §10 A port's tube is a separate body standing off the panel, so it
      // meshes separately and rides along with its panel for selection and
      // exploding.
      const tubes = tubesFor(i, panel).map((f) => {
        const t = portTube(oc, panel, f);
        return { ...triangulate(oc, t, E, opts), edges: edgeSegments(oc, t, E, opts), fitting: f };
      });
      return { ...mesh, edges: edgeSegments(oc, solid, E, opts), tubes };
    } catch (error) {
      return { failed: describeShapeFailure(error), face: panel.face, layer: panel.layer };
    }
  });
}
