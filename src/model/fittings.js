// Drivers and ports: the holes that make a box a speaker.
//
// §10 recorded the absence of these as the biggest gap in the model — without
// them the part templates are rectangles and not worth printing at 1:1.
//
// A fitting sits on one face, positioned in that face's two planar axes and
// measured from the envelope's origin corner, so its position reads straight
// off the face-on view. Everything is a circle or a ring of circles, which is
// what a router or a hole saw actually makes.

import { AXIS, AXES, FACE_LABEL } from "./constants.js";
import { panelAxes } from "./solver.js";

/** The two planar axes of a face, in x, y, z order. */
export const faceAxes = (face) => panelAxes(face).planar;

export const DEFAULT_DRIVER = {
  type: "driver",
  cutout: 116,        // the hole the cone moves through
  pcd: 147,           // pitch circle diameter of the mounting holes
  bolts: 5,           // "a set number of mounting holes"
  boltHole: 5,        // 5 mm clearance holes
};

export const DEFAULT_PORT = {
  type: "port",
  diameter: 68,       // internal diameter of the tube
  length: 150,        // tube length, measured from the inner face of the panel
  wall: 3,            // tube wall thickness
};

export const FITTING_DEFAULTS = { driver: DEFAULT_DRIVER, port: DEFAULT_PORT };

let nextId = 0;
export const newFitting = (type, face, at) => ({
  // A position of its own, always. Without one `at.a` is undefined, the bore is
  // built at NaN and the boolean does not fail — it grinds.
  ...FITTING_DEFAULTS[type], id: `f${++nextId}`, face, at: { a: 0, b: 0, ...at },
});

/**
 * Every circle a fitting cuts, in the face's planar coordinates.
 *
 * The bolt ring starts at top dead centre and runs clockwise, which is how
 * anyone marks out by hand. "Top" is +b, the face's second planar axis, which
 * for the four upright faces is z — so this is genuinely up on the object, not
 * merely up on the sheet.
 */
export function fittingCircles(f) {
  // Nothing downstream can do anything sensible with a hole at NaN, least of
  // all a boolean, so it never gets that far.
  if (![f.at?.a, f.at?.b].every(Number.isFinite)) return [];
  if (f.type === "port") return [{ role: "bore", d: f.diameter, at: f.at }];
  const out = [{ role: "cutout", d: f.cutout, at: f.at }];
  for (let i = 0; i < f.bolts; i++) {
    const theta = Math.PI / 2 - (i / f.bolts) * 2 * Math.PI;
    out.push({
      role: "bolt", d: f.boltHole, index: i,
      at: { a: f.at.a + (f.pcd / 2) * Math.cos(theta), b: f.at.b + (f.pcd / 2) * Math.sin(theta) },
    });
  }
  return out;
}

/** The radius of the smallest circle containing everything the fitting cuts. */
export function fittingExtent(f) {
  if (f.type === "port") return f.diameter / 2;
  return Math.max(f.cutout / 2, f.pcd / 2 + f.boltHole / 2);
}

/** The outside radius of a port's tube, which is what has to clear the cavity. */
export const portOuterRadius = (f) => f.diameter / 2 + f.wall;

/** Fittings on a given panel. A fitting belongs to the outermost panel of its face. */
export function fittingsFor(fittings, panel, owners) {
  return fittings.filter((f) => f.face === panel.face && owners[f.face] === panel);
}

/**
 * Which panel a fitting is cut into: the outermost one on that face, since that
 * is the panel a driver bolts to. Returns { face: panel } for the faces in use.
 */
export function fittingOwners(panels, faces) {
  const owners = {};
  for (const face of faces) {
    const on = panels.filter((p) => p.face === face);
    if (!on.length) continue;
    const [a, s] = AXIS[face];
    // Outermost means furthest out along the face's own axis.
    owners[face] = on.reduce((best, p) =>
      (s < 0 ? p.box[a][0] < best.box[a][0] : p.box[a][1] > best.box[a][1]) ? p : best);
  }
  return owners;
}

/** A fitting's position in model space, on the outer surface of its panel. */
export function fittingOrigin(f, panel) {
  const [a, s] = AXIS[f.face];
  const [p, q] = faceAxes(f.face);
  const v = {};
  v[a] = s < 0 ? panel.box[a][0] : panel.box[a][1];
  v[p] = f.at.a;
  v[q] = f.at.b;
  return { x: v.x, y: v.y, z: v.z, axis: a, sign: s };
}

const round1 = (v) => Math.round(v * 10) / 10;

/** §8 Fittings that will not cut cleanly. */
export function fittingIssues(fittings, panels, owners, cavity) {
  const msgs = [];
  const seen = [];

  for (const f of fittings) {
    const panel = owners[f.face];
    const label = `${describeFitting(f)} on the ${FACE_LABEL[f.face].toLowerCase()}`;
    if (!panel) {
      msgs.push({ level: "error", text: `${label}: there is no panel on that face.` });
      continue;
    }

    const [p, q] = faceAxes(f.face);
    const r = fittingExtent(f);
    if (![f.at?.a, f.at?.b].every(Number.isFinite)) {
      msgs.push({ level: "error", text: `${label} has no position on the panel.` });
      continue;
    }
    for (const [axis, at] of [[p, f.at.a], [q, f.at.b]]) {
      const lo = panel.box[axis][0], hi = panel.box[axis][1];
      if (at - r < lo || at + r > hi) {
        msgs.push({ level: "error",
          text: `${label} runs off the panel: it needs ${round1(r)} mm clearance and the panel spans ${round1(lo)}–${round1(hi)}.` });
      } else if (at - r < lo + 10 || at + r > hi - 10) {
        msgs.push({ level: "warning",
          text: `${label} leaves under 10 mm of material at the panel edge.` });
      }
    }

    if (f.type === "driver" && f.pcd / 2 - f.boltHole / 2 < f.cutout / 2) {
      msgs.push({ level: "warning",
        text: `${label}: the bolt holes break into the cutout — PCD ${f.pcd} against a ${f.cutout} mm hole.` });
    }
    if (f.type === "port") {
      const depth = cavity ? cavity[AXIS[f.face][0]][1] - cavity[AXIS[f.face][0]][0] : Infinity;
      if (f.length > depth) {
        msgs.push({ level: "warning",
          text: `${label}: the ${f.length} mm tube is longer than the ${round1(depth)} mm cavity — it will need a bend or a shorter tune.` });
      }
    }

    for (const other of seen) {
      if (other.face !== f.face) continue;
      const d = Math.hypot(f.at.a - other.at.a, f.at.b - other.at.b);
      if (d < fittingExtent(f) + fittingExtent(other)) {
        msgs.push({ level: "error",
          text: `${label} overlaps the ${describeFitting(other).toLowerCase()} beside it.` });
      }
    }
    seen.push(f);
  }
  return msgs;
}

export function describeFitting(f) {
  return f.type === "port"
    ? `Port ⌀${f.diameter} × ${f.length}`
    : `Driver ⌀${f.cutout}, ${f.bolts} × ⌀${f.boltHole} on ${f.pcd} PCD`;
}

/** A short note for the cut list. */
export function fittingNote(fittings) {
  if (!fittings.length) return "";
  return fittings.map(describeFitting).join("; ");
}

/**
 * Where a point on a face lands on the part template, in blank coordinates.
 *
 * The template is drawn as the blank is cut — longest side across — which for
 * a tall baffle is the face-on view laid on its side. It is not the elevation
 * rotated to match, and it should not be: the templates share one scale keyed
 * to the longest part, and that only works if every blank lies the same way.
 *
 * The width axis is flipped so that the two axes stay right-handed, so a
 * template laid on the panel the way it is drawn has its holes in the right
 * places rather than mirrored.
 */
export function toBlank(at, panel, blank, face) {
  const [p, q] = faceAxes(face);
  const along = (axis) => (axis === p ? at.a : at.b);
  return {
    x: along(blank.lengthAxis) - panel.box[blank.lengthAxis][0],
    y: panel.box[blank.widthAxis][1] - along(blank.widthAxis),
  };
}

/** Every circle a panel's fittings cut, in that panel's blank coordinates. */
export function blankCircles(fittings, panel, blank) {
  return fittings.flatMap((f) =>
    fittingCircles(f).map((c) => ({ ...c, ...toBlank(c.at, panel, blank, f.face), fitting: f })));
}

/** The bolt circle itself, drawn as a centre line rather than cut. */
export function blankBoltCircles(fittings, panel, blank) {
  return fittings.filter((f) => f.type === "driver").map((f) => ({
    ...toBlank(f.at, panel, blank, f.face), d: f.pcd, fitting: f,
  }));
}
