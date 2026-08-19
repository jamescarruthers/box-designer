// §10 Drivers and ports in the orthographic views.
//
// A circle on a face reads as a circle in the view that looks at that face, and
// as a pair of lines in the other two. The face-on view is where a driver is
// dimensioned and marked out, so that is where the bolt circle goes.

import { AXIS } from "../model/constants.js";
import { fittingCircles, faceAxes, portOuterRadius } from "../model/fittings.js";

/** Which view looks square-on at each face, and which way round it is. */
export const FACE_ON = { front: "front", back: "front", left: "end", right: "end", top: "plan", bottom: "plan" };

/** A point on a face, in a view's coordinates. */
export function toView(at, face, view, E) {
  const [p, q] = faceAxes(face);
  const v = { [p]: at.a, [q]: at.b };
  if (view === "front") return [v.x, E.z - v.z];
  if (view === "end") return [E.y - v.y, E.z - v.z];
  return [v.x, E.y - v.y];
}

/** Whether the face is the near one in its face-on view, which decides hidden lines. */
const NEAR_IN_VIEW = { front: true, back: false, left: true, right: false, top: true, bottom: false };

/**
 * Circles and bolt circles for one view.
 *
 * Only fittings on faces this view looks at square-on produce circles. A
 * fitting on a face seen edge-on gives the bore's two sides instead, which the
 * hidden line removal cannot know about because it only sees boxes.
 */
export function fittingGeometry(view, fittings, panels, owners, E) {
  const circles = [], boltCircles = [], lines = [];

  for (const f of fittings) {
    const panel = owners[f.face];
    if (!panel) continue;

    if (FACE_ON[f.face] === view) {
      const visible = NEAR_IN_VIEW[f.face];
      for (const c of fittingCircles(f)) {
        if (!(c.d > 0)) continue;
        circles.push({ at: toView(c.at, f.face, view, E), r: c.d / 2, visible, role: c.role, fitting: f });
      }
      if (f.type === "driver") {
        boltCircles.push({ at: toView(f.at, f.face, view, E), r: f.pcd / 2, fitting: f });
      }
      if (f.type === "port") {
        // The tube behind the panel, seen end-on.
        circles.push({ at: toView(f.at, f.face, view, E), r: portOuterRadius(f), visible: false, role: "tube", fitting: f });
      }
    } else {
      lines.push(...edgeOnLines(f, panel, view, E));
    }
  }
  return { circles, boltCircles, lines };
}

/**
 * A bore seen edge-on: its two sides, dashed, running through the panel. A port
 * carries its tube on into the cavity, which is the only place the tube's
 * length is visible at all.
 */
function edgeOnLines(f, panel, view, E) {
  const [a, s] = AXIS[f.face];
  const bore = f.type === "port" ? f.diameter : f.cutout;
  const out = [];

  const outer = s < 0 ? panel.box[a][0] : panel.box[a][1];
  const inner = s < 0 ? panel.box[a][1] : panel.box[a][0];
  const tubeEnd = f.type === "port" ? inner - s * f.length : inner;

  for (const [radius, to] of f.type === "port"
    ? [[bore / 2, tubeEnd], [portOuterRadius(f), tubeEnd]]
    : [[bore / 2, inner]]) {
    for (const side of [-1, 1]) {
      // Offset perpendicular to the bore, in whichever planar axis this view shows.
      const shifted = offsetAcross(f, side * radius, view);
      if (!shifted) continue;
      out.push({
        a: pointAt(shifted, f.face, outer, view, E),
        b: pointAt(shifted, f.face, to, view, E),
        visible: false, kind: "fitting",
      });
    }
  }
  return out;
}

/** The face's planar axis that this view still shows; the other one is edge-on. */
function offsetAcross(f, delta, view) {
  const [p, q] = faceAxes(f.face);
  const shown = { front: ["x", "z"], end: ["y", "z"], plan: ["x", "y"] }[view];
  if (shown.includes(p)) return { a: f.at.a + delta, b: f.at.b };
  if (shown.includes(q)) return { a: f.at.a, b: f.at.b + delta };
  return null;
}

function pointAt(at, face, depth, view, E) {
  const [p, q] = faceAxes(face);
  const [a] = AXIS[face];
  const v = { [p]: at.a, [q]: at.b, [a]: depth };
  if (view === "front") return [v.x, E.z - v.z];
  if (view === "end") return [E.y - v.y, E.z - v.z];
  return [v.x, E.y - v.y];
}
