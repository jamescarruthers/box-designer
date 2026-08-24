// §6.6 True isometric projection, eye front-right-above, each axis
// foreshortened to √(2/3) — not the stretched isometric-drawing convention.
//
// §38 Solid rather than wireframe. Each panel is drawn as a box: its three
// faces that point at the eye, filled with the paper and outlined, painted
// back to front so a panel in front covers what is behind it. That is what
// lets the assembly come apart — an exploded wireframe is a thicket — and it
// is what lets a cutout be drawn where it is, on the face that carries it,
// instead of being left off the one view where the box is shown whole.

import { AXIS } from "../model/constants.js";
import { faceAxes, fittingCircles } from "../model/fittings.js";
import { explodedBox } from "../model/explode.js";

export const ISO_X = Math.SQRT1_2, ISO_Y = Math.sqrt(1 / 6), ISO_Z = Math.sqrt(2 / 3);

export const isoProject = (v) => ({
  x: ISO_X * (v.x + v.y),
  y: ISO_Y * (v.x - v.y) - ISO_Z * v.z,
});

/**
 * The eye is front-right-above, so it sees the +x, −y and +z side of every
 * box and nothing else. Depth along the line of sight is x − y + z: the
 * direction that projects to a single point, which is the definition of it.
 */
export const ISO_EYE = { x: 1, y: -1, z: 1 };
const depthOf = (b) => (b.x[0] + b.x[1] - b.y[0] - b.y[1] + b.z[0] + b.z[1]) / 2;

const EPS = 1e-9;

/**
 * Is `a` in front of `b`? Only when the two are clear of each other along an
 * axis, and `a` is on the eye's side of it: further right, further forward, or
 * higher up.
 *
 * Boxes that pass this test are ordered exactly, which is every pair in a
 * solved box — prominence is what makes a panel stop where the next one starts,
 * so any two panels are clear of each other along at least one axis, and
 * exploding them only pulls them further apart. Comparing centres instead gets
 * a long thin panel wrong: its middle can be behind a small panel that the
 * whole of it stands in front of.
 */
export function inFront(a, b) {
  return a.x[0] >= b.x[1] - EPS || a.y[1] <= b.y[0] + EPS || a.z[0] >= b.z[1] - EPS;
}

/**
 * Back to front: a topological sort on "is in front of", with the depth of the
 * centre as the tie-break — for pairs that rule cannot separate, and for the
 * cycles it can produce in a box whose panels overlap.
 */
export function paintOrder(items) {
  const n = items.length;
  const after = items.map(() => []);       // drawn after this one
  const before = items.map(() => 0);       // how many must come first
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ij = inFront(items[i].box, items[j].box);
      const ji = inFront(items[j].box, items[i].box);
      if (ij === ji) continue;             // neither, or a contradiction
      const [back, front] = ij ? [j, i] : [i, j];
      after[back].push(front);
      before[front] += 1;
    }
  }
  const out = [];
  const left = items.map((_, i) => i);
  while (left.length) {
    const ready = left.filter((i) => before[i] === 0);
    // A cycle leaves nothing ready: take the furthest of what is left and
    // carry on, which is the answer the centres would have given anyway.
    const pool = ready.length ? ready : left;
    const pick = pool.reduce((a, b) => (depthOf(items[a].box) <= depthOf(items[b].box) ? a : b));
    out.push(items[pick]);
    left.splice(left.indexOf(pick), 1);
    for (const k of after[pick]) before[k] -= 1;
    before[pick] = Infinity;
  }
  return out;
}

/** The three faces the eye sees, as [fixed axis, which end of it]. */
const VISIBLE = [["x", 1], ["y", 0], ["z", 1]];

const OTHER = { x: ["y", "z"], y: ["x", "z"], z: ["x", "y"] };

/** How finely a circle is sampled. 48 keeps a ⌀160 hole smooth at 1:2. */
const CIRCLE_STEPS = 48;

const r6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * §38 One panel's visible faces, as projected rings.
 *
 * A face is a rectangle in two of the axes at a fixed value of the third, and
 * its four corners in order give a polygon that is convex in projection — so
 * it fills and outlines without any further thought.
 */
function panelFaces(box) {
  return VISIBLE.map(([fixed, end]) => {
    const [p, q] = OTHER[fixed];
    const at = box[fixed][end];
    const pts = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([ip, iq]) => {
      const v = { [fixed]: at, [p]: box[p][ip], [q]: box[q][iq] };
      return isoProject(v);
    });
    return { fixed, at, pts };
  });
}

/**
 * Which side of a panel the eye is on: the outer face of a front, left or
 * bottom panel, and the inner face of a back, right or top one.
 *
 * It decides where a hole is drawn and whether it is drawn at all. A hole
 * bored from the mounting face and stopped short of the back of the panel is
 * on one side of it and not the other, which is the whole point of a blind
 * hole; seen from the side it does not reach, it is not there.
 */
function holeSides(panel, box) {
  const [axis, sign] = AXIS[panel.face];
  // The mounting face is the outer one: the low end for front/left/bottom.
  const mountEnd = sign < 0 ? 0 : 1;
  const eyeEnd = axis === "y" ? 0 : 1;               // the eye sees +x, −y, +z
  const thickness = Math.abs(box[axis][1] - box[axis][0]);
  return { axis, mountEnd, eyeEnd, thickness, seenFromMount: mountEnd === eyeEnd };
}

/** A circle on a face, sampled and projected, at a given depth into the panel. */
function ring(face, centre, r, axis, at) {
  const [p, q] = faceAxes(face);
  const out = [];
  for (let i = 0; i < CIRCLE_STEPS; i++) {
    const t = (i / CIRCLE_STEPS) * 2 * Math.PI;
    const v = { [axis]: at, [p]: centre.a + r * Math.cos(t), [q]: centre.b + r * Math.sin(t) };
    out.push(isoProject({ x: v.x, y: v.y, z: v.z }));
  }
  return out;
}

/** Is a projected point inside a projected ring? Ray casting; the ring is convex. */
function inside(pts, pt) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > pt.y) !== (b.y > pt.y) &&
        pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * The holes in one panel, as seen from wherever the eye is.
 *
 * The near rim is the full circle. The far rim — the other end of the bore —
 * is drawn only where it shows through the near one, which is the arc of the
 * hole's wall a reader actually sees. Drawing the whole of it would put a
 * second complete ellipse outside the first and turn a hole into a bump.
 */
function panelHoles(panel, box, fittings) {
  const { axis, eyeEnd, thickness, seenFromMount } = holeSides(panel, box);
  // Into the panel, away from the eye.
  const inward = eyeEnd === 0 ? 1 : -1;
  const surface = box[axis][eyeEnd];
  const out = [];
  for (const f of fittings) {
    for (const c of fittingCircles(f)) {
      if (!(c.d > 0)) continue;
      // §36 A blind hole exists on the face it was bored from and nowhere else.
      const deep = Number.isFinite(c.deep) && c.deep > 0 ? c.deep : Infinity;
      if (!seenFromMount && deep < thickness) continue;
      const near = ring(f.face, c.at, c.d / 2, axis, surface);
      out.push({ pts: near, closed: true });
      // Only the big hole is deep enough to show its wall at drawing scale.
      if (c.role === "bolt") continue;
      const reach = seenFromMount ? Math.min(deep, thickness) : thickness;
      const far = ring(f.face, c.at, c.d / 2, axis, surface + inward * reach);
      for (const run of runsInside(far, near)) out.push({ pts: run, closed: false });
    }
  }
  return out;
}

/** The stretches of a ring that fall inside another one, as open polylines. */
function runsInside(pts, within) {
  const keep = pts.map((p) => inside(within, p));
  if (!keep.some(Boolean)) return [];
  if (keep.every(Boolean)) return [pts];
  // Start where a run starts, so no run is split across the end of the array.
  const from = keep.findIndex((k, i) => k && !keep[(i - 1 + keep.length) % keep.length]);
  const runs = [];
  let run = [];
  for (let i = 0; i < pts.length; i++) {
    const k = (from + i) % pts.length;
    if (keep[k]) run.push(pts[k]);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length > 1);
}

/**
 * §38 Build the isometric: every panel, painted back to front.
 *
 * `fittingsOn` is the same function the cut list and the kernel use, so a hole
 * that §33 stopped at the baffle is drawn in the baffle and not in the doubler
 * behind it — and when the box is exploded, that reads.
 */
export function buildIsometric(sol, { explode = 0, fittingsOn = null } = {}) {
  const { panels } = sol;
  const groups = [];

  const ordered = paintOrder(panels.map((panel) => ({ panel, box: explodedBox(panel, explode) })));

  for (const { panel, box } of ordered) {
    const faces = panelFaces(box);
    const holes = fittingsOn ? panelHoles(panel, box, fittingsOn(panel)) : [];
    groups.push({ panel, faces, holes, edges: outline(faces) });
  }

  const all = groups.flatMap((g) => [
    ...g.faces.flatMap((f) => f.pts),
    ...g.holes.flatMap((h) => h.pts),
  ]);
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const min = { x: Math.min(...xs), y: Math.min(...ys) };
  const ext = { h: Math.max(...xs) - min.x, v: Math.max(...ys) - min.y };
  const to = (p) => [p.x - min.x, p.y - min.y];

  return {
    view: "iso", ext, arcs: [], hatches: [], lines: [],
    // Drawn in this order and no other: each panel's fills, then its own
    // lines, then the next panel over the top of them.
    groups: groups.map((g) => ({
      // Which panel this is, so the drawing can be read back: the mitred front
      // runs to the corner where the butted one stops a thickness short of it,
      // and that is a difference in one face of one panel.
      face: g.panel.face, layer: g.panel.layer,
      fills: g.faces.map((f) => ({ axis: f.fixed, pts: f.pts.map(to) })),
      lines: [
        ...g.edges.map((e) => ({ pts: e.map(to), closed: false })),
        ...g.holes.map((h) => ({ pts: h.pts.map(to), closed: h.closed })),
      ],
    })),
  };
}

/**
 * The lines of one panel: the outline of each visible face. Shared edges are
 * drawn once — three quadrilaterals meeting at a corner share three of their
 * twelve sides, and a line drawn twice is a line drawn heavier.
 */
function outline(faces) {
  const seen = new Map();
  for (const f of faces) {
    for (let i = 0; i < f.pts.length; i++) {
      const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
      const ka = `${r6(a.x)},${r6(a.y)}`, kb = `${r6(b.x)},${r6(b.y)}`;
      if (ka === kb) continue;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (!seen.has(key)) seen.set(key, [a, b]);
    }
  }
  return [...seen.values()];
}
