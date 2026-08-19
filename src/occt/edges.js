// §4 The edge overlay, from the kernel's topology rather than from triangles.
//
// `EdgesGeometry` infers edges from dihedral angle, and §4 sets the threshold to
// 24° so a fillet's tessellation facets do not show. But a fillet meets the flat
// face *tangentially* — zero dihedral — so that boundary is suppressed too, and
// the wireframe comes out with a hole where every round-over is: the flat face
// it runs to has no outline.
//
// OCCT knows the real edges. Taking them from the B-Rep gives the tangent
// boundaries and the sharp creases, and none of the tessellation.

import { edgesOf } from "./solids.js";
import { toThree } from "../three/panelGeometry.js";

/** Chord height for flattening a curved edge, in millimetres. */
export const EDGE_DEFLECTION = 0.15;

/**
 * Every edge of a solid as a flat array of line-segment endpoint pairs, in
 * three.js coordinates — the layout `THREE.LineSegments` wants.
 */
export function edgeSegments(oc, shape, E, { deflection = EDGE_DEFLECTION } = {}) {
  const out = [];
  for (const edge of edgesOf(oc, shape)) {
    const curve = new oc.BRepAdaptor_Curve_2(edge);
    const first = curve.FirstParameter(), last = curve.LastParameter();
    const d = new oc.GCPnts_QuasiUniformDeflection_4(curve, deflection, first, last, oc.GeomAbs_Shape.GeomAbs_C1);
    const points = [];
    if (d.IsDone() && d.NbPoints() >= 2) {
      for (let i = 1; i <= d.NbPoints(); i++) {
        const p = d.Value(i);
        points.push(toThree([p.X(), p.Y(), p.Z()], E));
      }
    } else {
      for (const u of [first, last]) {
        const p = curve.Value(u);
        points.push(toThree([p.X(), p.Y(), p.Z()], E));
      }
    }
    for (let i = 0; i + 1 < points.length; i++) out.push(points[i], points[i + 1]);
  }

  const positions = new Float32Array(out.length * 3);
  out.forEach((p, i) => { positions.set(p, i * 3); });
  return { positions, segments: out.length / 2 };
}
