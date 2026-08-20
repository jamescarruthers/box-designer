// §10 Drivers and ports in the orthographic views.
//
// A circle on a face reads as a circle in the view that looks at that face, and
// as a pair of lines in the other two. The face-on view is where a driver is
// dimensioned and marked out, so that is where the bolt circle goes.

import { AXIS } from "../model/constants.js";
import { fittingCircles, faceAxes, portOuterRadius, hasTube } from "../model/fittings.js";
import { fmt } from "../cutlist/cutlist.js";

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
      if (hasTube(f)) {
        // The tube behind the panel, seen end-on. Nothing to draw without one:
        // the bore's own circle is already there.
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
  const tube = hasTube(f);
  const out = [];

  const outer = s < 0 ? panel.box[a][0] : panel.box[a][1];
  const inner = s < 0 ? panel.box[a][1] : panel.box[a][0];
  // Without a tube the bore stops at the inner face, like a driver's cutout.
  const tubeEnd = tube ? inner - s * f.length : inner;

  for (const [radius, to] of tube
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


/**
 * §6.7 Dimensions for the fittings, in the view that looks at them square-on.
 *
 * A hole is dimensioned by diameter, never by radius, and the dimension line
 * runs through the centre with its arrows on the circle — ISO 129 again. The
 * bolt circle takes a diameter too, marked PCD, because that is the number a
 * maker sets a compass to. The bolt holes themselves are all the same, so they
 * are dimensioned once on a leader and counted: `5×⌀5`.
 *
 * The angles are fixed rather than fitted. §10 already records that this sheet
 * has no dimension collision avoidance; these point away from each other, which
 * is as far as hand-tuning goes.
 */
export const DIM_ANGLE = { bore: -150, pcd: 30, bolt: -60 };

/**
 * A fitting on the far face shares its view with anything on the near one, and
 * at 1:5 two sets of leaders in the same quadrant are unreadable. Turn the far
 * one's through half a turn so the two sets go opposite ways.
 */
const FAR = { back: true, right: true, bottom: true };
const spread = (angle, face) => (FAR[face] ? angle + 180 : angle);

export function fittingDimensions(view, fittings, E) {
  const out = [];
  for (const f of fittings ?? []) {
    if (FACE_ON[f.face] !== view) continue;
    const at = toView(f.at, f.face, view, E);
    const a = (which) => spread(DIM_ANGLE[which], f.face);

    if (f.type === "port") {
      // The length belongs to the tube, so it is only quoted when there is one.
      out.push({ kind: "diameter", at, r: f.diameter / 2, angle: a("bore"),
        text: hasTube(f) ? `⌀${fmt(f.diameter)} × ${fmt(f.length)}` : `⌀${fmt(f.diameter)}`,
        fitting: f });
      continue;
    }

    out.push({ kind: "diameter", at, r: f.cutout / 2, angle: a("bore"),
      text: `⌀${fmt(f.cutout)}`, fitting: f });
    if (!(f.bolts > 0) || !(f.boltHole > 0)) continue;

    out.push({ kind: "diameter", at, r: f.pcd / 2, angle: a("pcd"),
      text: `⌀${fmt(f.pcd)} PCD`, fitting: f });
    // Leadered off one hole, and counted: they are identical by construction.
    const bolt = fittingCircles(f).find((c) => c.role === "bolt");
    out.push({ kind: "leader", at: toView(bolt.at, f.face, view, E), r: f.boltHole / 2,
      angle: a("bolt"), text: `${f.bolts}×⌀${fmt(f.boltHole)}`, fitting: f });
  }
  return out;
}
