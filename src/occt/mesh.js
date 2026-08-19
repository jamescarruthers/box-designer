// §4 Triangles for the 3D view, from the kernel.
//
// The analytic path approximates a fillet with an eight-step ring stack and
// cannot represent the blend where two fillets meet at a corner. The kernel
// meshes the real surface, so the 3D view and the drawing finally describe the
// same solid.

import { toThree } from "../three/panelGeometry.js";
import { panelSolid } from "./solids.js";
import { edgeSegments } from "./edges.js";

/** Chord height for the mesh, in millimetres. Small enough that R12 reads round. */
export const LINEAR_DEFLECTION = 0.25;
export const ANGULAR_DEFLECTION = 0.3;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/**
 * Triangulate one solid into three.js coordinates.
 *
 * §4.4 still applies: every triangle is oriented outward against the solid's
 * centroid rather than trusted from the face orientation. A panel is convex, so
 * the test is exact, and it costs nothing next to the meshing.
 */
export function triangulate(oc, shape, E, {
  linear = LINEAR_DEFLECTION, angular = ANGULAR_DEFLECTION,
} = {}) {
  new oc.BRepMesh_IncrementalMesh_2(shape, linear, false, angular, false);

  const tris = [];
  const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const loc = new oc.TopLoc_Location_1();
    const handle = oc.BRep_Tool.Triangulation(face, loc, 0);
    if (!handle.IsNull()) {
      const poly = handle.get();
      const trsf = loc.Transformation();
      const nodes = [];
      for (let i = 1; i <= poly.NbNodes(); i++) {
        const p = poly.Node(i).Transformed(trsf);
        nodes.push(toThree([p.X(), p.Y(), p.Z()], E));
      }
      for (let i = 1; i <= poly.NbTriangles(); i++) {
        const t = poly.Triangle(i);
        tris.push([nodes[t.Value(1) - 1], nodes[t.Value(2) - 1], nodes[t.Value(3) - 1]]);
      }
    }
    explorer.Next();
  }

  const centroid = [0, 1, 2].map((k) =>
    tris.reduce((a, t) => a + t[0][k] + t[1][k] + t[2][k], 0) / (tris.length * 3 || 1));

  const positions = new Float32Array(tris.length * 9);
  let o = 0, flipped = 0;
  for (const t of tris) {
    let [a, b, c] = t;
    const n = cross(sub(b, a), sub(c, a));
    const m = [0, 1, 2].map((d) => (a[d] + b[d] + c[d]) / 3 - centroid[d]);
    if (dot(n, m) < 0) { [b, c] = [c, b]; flipped++; }
    for (const p of [a, b, c]) { positions[o++] = p[0]; positions[o++] = p[1]; positions[o++] = p[2]; }
  }
  return { positions, triangles: tris.length, flipped, centroid };
}

/**
 * Every panel, meshed, with its real edges alongside. Indices line up with
 * `sol.panels`. The edges come from the topology, not from the triangles — see
 * edges.js for why that matters at a fillet.
 */
export function meshPanels(oc, panels, bevelsFor, E, opts = {}) {
  return panels.map((panel, i) => {
    const solid = panelSolid(oc, panel, bevelsFor(i, panel));
    const mesh = triangulate(oc, solid, E, opts);
    return { ...mesh, edges: edgeSegments(oc, solid, E, opts) };
  });
}
