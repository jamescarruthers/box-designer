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
  tube: true,         // whether a tube is fitted behind the hole
  diameter: 68,       // inside diameter: the bore, through the panel and the tube alike
  length: 150,        // tube length, measured from the inner face of the panel
  wall: 3,            // tube wall thickness, which gives the outside diameter
};

/**
 * Whether a port carries a tube.
 *
 * Not every port does. A short one in a thick baffle is a plain hole, and a
 * bought tube is often left off the drawing and fitted on assembly. The bore is
 * the same either way — it is the tube's inside diameter, continuous from the
 * outer face of the panel to the end of the tube — so this changes what is
 * drawn and modelled behind the panel, and nothing about the hole.
 *
 * Read as "not false" rather than "true" so a port saved before the option
 * existed keeps its tube instead of quietly losing it.
 */
export const hasTube = (f) => f?.type === "port" && f.tube !== false;

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

/**
 * Every panel a fitting is cut through, outermost first.
 *
 * A hole goes all the way. Cladding, carcass, doubler: a driver bolted to the
 * front of a clad and doubled panel passes through all three, and cutting only
 * the outermost left a 116 mm cutout opening onto solid material behind. The
 * layers are stacked along the face's own axis, so a bore that enters the first
 * enters all of them — there is nothing to work out beyond the order.
 */
export function fittingStack(panels, face) {
  const [a, s] = AXIS[face];
  const outerness = (p) => (s < 0 ? p.box[a][0] : -p.box[a][1]);
  return panels.filter((p) => p.face === face).sort((x, y) => outerness(x) - outerness(y));
}

/** Fittings cut into a given panel: every fitting on that panel's face. */
export function fittingsFor(fittings, panel) {
  return fittings.filter((f) => f.face === panel.face);
}

/**
 * The panel a fitting is set out from: the outermost on that face, since that
 * is the face a driver bolts to and the surface the position is measured on.
 * Returns { face: panel } for the faces in use.
 */
export function fittingOwners(panels, faces) {
  const owners = {};
  for (const face of faces) {
    const [outer] = fittingStack(panels, face);
    if (outer) owners[face] = outer;
  }
  return owners;
}

/**
 * The panel a port's tube hangs off: the innermost, since the tube stands into
 * the cavity. One tube per port however many layers the bore went through.
 */
export function innermostOn(panels, face) {
  return fittingStack(panels, face).at(-1);
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

/** How a layer reads in a message about a hole going through it. */
const LAYER_WORD = { cladding: "cladding", shell: "carcass panel", doubler: "doubler" };

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
    // Every layer, not only the one it is set out from. A doubler is inset from
    // the carcass panel it backs, so a bore can sit comfortably in the carcass
    // and run off the edge of the doubler behind it — and the bore goes through
    // both, so that is a hole opening into fresh air.
    for (const through of fittingStack(panels, f.face)) {
      const where = through === panel ? "the panel"
        : `the ${LAYER_WORD[through.layer] ?? through.layer} behind it`;
      for (const [axis, at] of [[p, f.at.a], [q, f.at.b]]) {
        const lo = through.box[axis][0], hi = through.box[axis][1];
        if (at - r < lo || at + r > hi) {
          msgs.push({ level: "error",
            text: `${label} runs off ${where}: it needs ${round1(r)} mm clearance and it spans ${round1(lo)}–${round1(hi)}.` });
        } else if (at - r < lo + 10 || at + r > hi - 10) {
          msgs.push({ level: "warning",
            text: `${label} leaves under 10 mm of material at the edge of ${where}.` });
        }
      }
    }

    if (f.type === "driver" && f.pcd / 2 - f.boltHole / 2 < f.cutout / 2) {
      msgs.push({ level: "warning",
        text: `${label}: the bolt holes break into the cutout — PCD ${f.pcd} against a ${f.cutout} mm hole.` });
    }
    if (hasTube(f)) {
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
  if (f.type !== "port") return `Driver ⌀${f.cutout}, ${f.bolts} × ⌀${f.boltHole} on ${f.pcd} PCD`;
  return hasTube(f) ? `Port ⌀${f.diameter} × ${f.length}` : `Port ⌀${f.diameter}, no tube`;
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
