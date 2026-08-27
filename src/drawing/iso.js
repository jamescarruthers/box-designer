// §6.6 True isometric projection, eye front-right-above, each axis
// foreshortened to √(2/3) — not the stretched isometric-drawing convention.
//
// §38 Solid rather than wireframe. Each panel is drawn as a box: its three
// faces that point at the eye, filled with the paper and outlined, painted
// back to front so a panel in front covers what is behind it. That is what
// lets the assembly come apart — an exploded wireframe is a thicket — and it
// is what lets a cutout be drawn where it is, on the face that carries it,
// instead of being left off the one view where the box is shown whole.

import { AXIS, AXES, PAIR } from "../model/constants.js";
import { faceAxes, fittingCircles } from "../model/fittings.js";
import { explodedBox } from "../model/explode.js";
import { ringAt, ringDepths, mitresOnly, notchDepth } from "../three/panelGeometry.js";
import { subtractCells } from "../model/rebate.js";
import { mitredCells } from "../model/mitre.js";

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

/** The box a face occupies, which is flat in one axis and is meant to be. */
const boundsOf = (pts) => Object.fromEntries(AXES.map((b) =>
  [b, [Math.min(...pts.map((v) => v[b])), Math.max(...pts.map((v) => v[b]))]]));

/**
 * §54 Back to front *within* one panel.
 *
 * A box is convex, so its three visible faces never overlap on the paper and
 * the order they come back in cannot be wrong. A grooved board is not convex:
 * the step at the bottom of a rebate faces the eye and so does the board's own
 * outer face in front of it, and they overlap on the paper exactly where the
 * groove is. Painted in the order the cells happen to be built, the inside of
 * the groove is painted over the board it is cut into — which is the rebate
 * drawn in front of the face it is on.
 *
 * The same sort the panels themselves get, on the boxes the faces occupy. It
 * changes nothing for a convex panel, where any order is right.
 */
function facePaintOrder(quads) {
  if (quads.length < 2) return quads;
  return paintOrder(quads.map((quad) => ({ quad, box: boundsOf(quad.pts) }))).map((i) => i.quad);
}

/**
 * §40 One panel's surface: the loft the 3D view is built from, as quads.
 *
 * A panel is not a box the moment an edge is filleted or chamfered, and §38
 * drew it as one — the isometric was the last view on the sheet still showing
 * square corners on a box with round ones. The rings are the same rings
 * `panelSolid` lofts: the cross-section at each depth from the outer face
 * inward, narrowing as each bevel eats into it.
 *
 * Every quad is turned to face outward against the panel's centre, which a
 * bevelled box lets you do exactly because it is still convex. Then the ones
 * the eye can see are the ones whose normal points at it.
 *
 * §49 A grooved panel goes to `grooveQuads` instead, and the two invariants
 * that hold for both are worth stating: the surface closes — every edge has a
 * face on each side of it — and it encloses the volume the model gives the
 * panel. Exported so a test can say so.
 */
export function panelQuads(panel, box, bevels) {
  // §42 An exploded panel takes its grooves with it.
  const moved = box === panel.box ? panel : {
    ...panel, box,
    notches: (panel.notches ?? []).map((n) => Object.fromEntries(AXES.map((b) =>
      [b, [n[b][0] + box[b][0] - panel.box[b][0], n[b][1] + box[b][0] - panel.box[b][0]]]))),
  };
  const [a, s] = AXIS[panel.face];
  const [p, q] = AXES.filter((b) => b !== a);
  const T = box[a][1] - box[a][0];

  // Which face each side of the rectangle belongs to, so a side can be asked
  // what it was bevelled with.
  const sideFace = [PAIR[q][0], PAIR[p][1], PAIR[q][1], PAIR[p][0]];

  const groove = notchDepth(moved);
  // §49 A grooved panel is drawn as the cells it is left as — the same shape
  // the model reckons its volume from (§44), mitres and all. The loft cannot
  // do it: it works depth by depth from the outer face, and a groove is a
  // hole in a plane rather than a narrowing of one, so the two were built
  // apart and met along faces neither knew about. What is given up is a round
  // on a grooved board, drawn square; a closed solid with a square arris beats
  // a rounded one with holes in its surface.
  if (groove !== null) return grooveQuads(moved, box);
  const stop = T;
  const depths = ringDepths(moved, bevels).filter((d) => d <= stop + EPS);
  if (!depths.some((d) => Math.abs(d - stop) < EPS)) depths.push(stop);
  depths.sort((u, v) => u - v);

  const rings = depths.map((d) => {
    const rect = d >= T - EPS
      ? ringAt(moved, mitresOnly(bevels), T)       // §12 the final ring is mitres alone
      : ringAt(moved, bevels, d);
    const coord = s < 0 ? box[a][0] + d : box[a][1] - d;
    return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([ip, iq]) => {
      const v = { [a]: coord, [p]: rect[p][ip], [q]: rect[q][iq] };
      return { x: v.x, y: v.y, z: v.z };
    });
  });

  /**
   * Is the boundary at this depth, on this side, one the drawing shows?
   *
   * The outer and inner faces always, and the depth at which a bevel runs out
   * into the side of the panel. Nothing else: a fillet is tangent to the face
   * it starts from, so the eight facets it is lofted from meet at angles no
   * line belongs at, and a filleted edge is a pair of lines with nothing
   * between them — which is what it looks like.
   *
   * The depths are shared by all four sides, so most of them are boundaries
   * only because some *other* side is rounded there. A line across the middle
   * of a flat face because the edge beside it was filleted is the same mistake
   * as a line across the round.
   */
  const sharpAt = (side, d) => {
    if (d <= EPS || d >= T - EPS) return true;
    const t = bevels[side];
    return !!(t && t.radius > 0 && Math.abs(d - t.radius) < EPS);
  };

  const quads = [];
  const add = (pts, edges) => {
    // A ring can collapse — opposite insets meeting, or a mitre at full
    // thickness — and a quad with no area is not a face.
    const uniq = pts.filter((pt, i) => !pts.some((o, j) =>
      j < i && Math.abs(o.x - pt.x) < EPS && Math.abs(o.y - pt.y) < EPS && Math.abs(o.z - pt.z) < EPS));
    if (uniq.length < 3) return;
    quads.push({ pts, edges });
  };

  // The outer cap first: it is the panel's own face, and the one anything
  // asking "which way is this panel looking" wants to find.
  add(rings[0], [true, true, true, true]);
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let c = 0; c < 4; c++) {
      const d = (c + 1) % 4;
      const side = sideFace[c];
      add([A[c], A[d], B[d], B[c]], [
        sharpAt(side, depths[r]),        // the boundary this band starts at
        true,                            // the corner it shares with the next side
        sharpAt(side, depths[r + 1]),    // the boundary it ends at
        true,                            // and the corner on the other hand
      ]);
    }
  }
  add(rings[rings.length - 1], [true, true, true, true]);

  // Outward, against the centre of the panel.
  const c = { x: 0, y: 0, z: 0 };
  let n = 0;
  for (const ring of rings) for (const v of ring) { c.x += v.x; c.y += v.y; c.z += v.z; n++; }
  c.x /= n; c.y /= n; c.z /= n;
  for (const quad of quads) {
    const nrm = quadNormal(quad.pts);
    const mid = quad.pts.reduce((acc, v) => ({ x: acc.x + v.x / 4, y: acc.y + v.y / 4, z: acc.z + v.z / 4 }),
      { x: 0, y: 0, z: 0 });
    const out = (mid.x - c.x) * nrm.x + (mid.y - c.y) * nrm.y + (mid.z - c.z) * nrm.z;
    if (out < 0) { nrm.x *= -1; nrm.y *= -1; nrm.z *= -1; }
    quad.normal = nrm;
    quad.visible = nrm.x * ISO_EYE.x + nrm.y * ISO_EYE.y + nrm.z * ISO_EYE.z > EPS;
    quad.axis = ["x", "y", "z"]
      .reduce((best, k) => (Math.abs(nrm[k]) > Math.abs(nrm[best]) ? k : best), "x");
  }
  return quads;
}

/**
 * §49 A grooved panel's surface, from the cells the groove leaves it as.
 *
 * `subtractCells` cuts the box at every face of every notch and keeps what is
 * outside them, so the cells meet each other across whole faces — which is what
 * lets the faces that are inside the board cancel, exactly, two identical
 * rectangles back to back. (`subtractBoxes` glues those cells together again,
 * and two boards meeting along half a face cannot cancel: that is what left the
 * isometric of a rebated box with faces inside the material and holes in its
 * surface.)
 *
 * §44's mitre clipping is applied to each cell, so a board that is both mitred
 * and grooved comes out as the one shape the model gives it rather than as a
 * mitred loft and a square slab that disagree about where the board stops.
 */
function grooveQuads(panel, box) {
  const quads = [];
  const add = (pts, ref) => {
    const uniq = pts.filter((pt, i) => !pts.some((o, j) =>
      j < i && Math.abs(o.x - pt.x) < EPS && Math.abs(o.y - pt.y) < EPS && Math.abs(o.z - pt.z) < EPS));
    if (uniq.length < 3) return;
    // Every face of a groove is a real edge: there is no smooth anything in a
    // board that has had a slot cut down it.
    quads.push({ pts, edges: pts.map(() => true), ref });
  };
  const centroid = (pts) => pts.reduce((acc, v, _, all) => ({
    x: acc.x + v.x / all.length, y: acc.y + v.y / all.length, z: acc.z + v.z / all.length,
  }), { x: 0, y: 0, z: 0 });

  for (const cell of subtractCells(box, panel.notches)) {
    const pieces = mitredCells(panel, cell);
    if (!pieces) {
      const mid = { x: (cell.x[0] + cell.x[1]) / 2, y: (cell.y[0] + cell.y[1]) / 2, z: (cell.z[0] + cell.z[1]) / 2 };
      for (const face of boxQuads(cell)) add(face.map((v) => ({ x: v.x, y: v.y, z: v.z })), mid);
      continue;
    }
    // A clipped cell is a prism: the cross-section at each end, and one face
    // per side of it run along the length.
    for (const { axis, thick, run, poly, at } of pieces) {
      const to = (uw, r) => {
        const v = { [axis]: uw[0], [thick]: uw[1], [run]: r };
        return { x: v.x, y: v.y, z: v.z };
      };
      const caps = [poly.map((uw) => to(uw, at[0])), poly.map((uw) => to(uw, at[1]))];
      const mid = centroid([...caps[0], ...caps[1]]);
      for (const cap of caps) add(cap, mid);
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        add([to(poly[i], at[0]), to(poly[j], at[0]), to(poly[j], at[1]), to(poly[i], at[1])], mid);
      }
    }
  }

  // Faces two cells share are inside the board, and a line there is a line
  // through solid material. Every such face is shared whole, so the pair
  // cancels exactly and what is left is the outside of the shape.
  const seen = new Map();
  for (const quad of quads) {
    quad.key = quad.pts.map(key3).sort().join("|");
    seen.set(quad.key, (seen.get(quad.key) ?? 0) + 1);
  }
  const kept = quads.filter((quad) => seen.get(quad.key) === 1);

  // Outward, against the centre of the piece each face belongs to — a grooved
  // board is not convex, but every cell of it is.
  for (const quad of kept) {
    const nrm = quadNormal(quad.pts);
    const mid = centroid(quad.pts);
    const out = (mid.x - quad.ref.x) * nrm.x + (mid.y - quad.ref.y) * nrm.y + (mid.z - quad.ref.z) * nrm.z;
    if (out < 0) { nrm.x *= -1; nrm.y *= -1; nrm.z *= -1; }
    quad.normal = nrm;
    quad.visible = nrm.x * ISO_EYE.x + nrm.y * ISO_EYE.y + nrm.z * ISO_EYE.z > EPS;
    quad.axis = ["x", "y", "z"]
      .reduce((best, k) => (Math.abs(nrm[k]) > Math.abs(nrm[best]) ? k : best), "x");
  }
  return kept;
}

/** The six faces of a box, each as four corners going round. */
function boxQuads(b) {
  const [X, Y, Z] = AXES;
  const at = (ix, iy, iz) => ({ [X]: b[X][ix], [Y]: b[Y][iy], [Z]: b[Z][iz] });
  return [
    [at(0, 0, 0), at(1, 0, 0), at(1, 1, 0), at(0, 1, 0)],
    [at(0, 0, 1), at(1, 0, 1), at(1, 1, 1), at(0, 1, 1)],
    [at(0, 0, 0), at(1, 0, 0), at(1, 0, 1), at(0, 0, 1)],
    [at(0, 1, 0), at(1, 1, 0), at(1, 1, 1), at(0, 1, 1)],
    [at(0, 0, 0), at(0, 1, 0), at(0, 1, 1), at(0, 0, 1)],
    [at(1, 0, 0), at(1, 1, 0), at(1, 1, 1), at(1, 0, 1)],
  ];
}

function quadNormal(pts) {
  const u = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y, z: pts[1].z - pts[0].z };
  const v = { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y, z: pts[2].z - pts[0].z };
  const n = {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / len, y: n.y / len, z: n.z / len };
}

/**
 * §40 The lines of one panel.
 *
 * An edge is drawn when it is the silhouette — one face either side of it and
 * only one of them turned towards the eye — or when both faces are visible and
 * the edge between them is a real edge rather than one step of a round.
 * Everything else is inside a surface, and a line there is a line the box
 * does not have.
 */
function panelLines(quads) {
  const seen = new Map();
  for (const quad of quads) {
    for (let i = 0; i < quad.pts.length; i++) {
      const u = quad.pts[i], v = quad.pts[(i + 1) % quad.pts.length];
      const ku = key3(u), kv = key3(v);
      if (ku === kv) continue;
      const k = ku < kv ? `${ku}|${kv}` : `${kv}|${ku}`;
      const found = seen.get(k) ?? { u, v, faces: 0, visible: 0, feature: false, normals: [] };
      found.faces += 1;
      if (quad.visible) found.visible += 1;
      if (quad.edges[i]) found.feature = true;
      found.normals.push(quad.normal);
      seen.set(k, found);
    }
  }
  for (const e of seen.values()) {
    // Flat where every face along it points the same way.
    e.flat = e.normals.length > 1 && e.normals.every((n) =>
      n.x * e.normals[0].x + n.y * e.normals[0].y + n.z * e.normals[0].z > 1 - 1e-9);
  }
  const out = [];
  for (const e of seen.values()) {
    if (e.visible === 0) continue;
    // §49 A line needs a corner to be at. Two faces in the same plane are one
    // surface however they were built, and the join between them — a groove's
    // cells against the loft they sit on, or one cell against the next — is
    // not an edge of the board. The silhouette is the exception: there the
    // second face is turned away, so there is a corner whatever the planes do.
    if (e.visible === 1) { out.push([e.u, e.v]); continue; }
    if (e.feature && !e.flat) out.push([e.u, e.v]);
  }
  return out;
}

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const key3 = (v) => `${r6(v.x)},${r6(v.y)},${r6(v.z)}`;

/** How finely a circle is sampled. 48 keeps a ⌀160 hole smooth at 1:2. */
const CIRCLE_STEPS = 48;

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
 * §54 Every panel's surface, in the order the picture is painted: the panels
 * back to front, and the faces within each panel back to front too.
 *
 * Exported because that order is the whole of what makes a solid isometric
 * read, and the only way to test it is to ask what was actually painted where.
 *
 * The panels are sorted on the box **prominence** left them, not the one a
 * rebate grew. A tongue reaches into the panel beside it, so a rebated panel's
 * box is no longer clear of its neighbours' along any axis — and `inFront`
 * answers "neither" to a pair like that, which drops them to the tie-break and
 * paints the rebated board over the one standing in front of it. The core is
 * the box that still has the property the sort is built on.
 */
export function isoSurfaces(sol, { explode = 0, bevelsOf = null } = {}) {
  const ordered = paintOrder(sol.panels.map((panel, index) => ({
    panel, index,
    drawn: explodedBox(panel, explode),
    box: explodedBox(panel.core ? { ...panel, box: panel.core } : panel, explode),
  })));
  return ordered.map(({ panel, index, drawn }) => {
    const quads = panelQuads(panel, drawn, bevelsOf?.(panel, index) ?? {});
    return { panel, index, box: drawn, quads, visible: facePaintOrder(quads.filter((q) => q.visible)) };
  });
}

/**
 * §38 Build the isometric: every panel, painted back to front.
 *
 * `fittingsOn` is the same function the cut list and the kernel use, so a hole
 * that §33 stopped at the baffle is drawn in the baffle and not in the doubler
 * behind it — and when the box is exploded, that reads.
 *
 * §40 `bevelsOf` is the panel's edge treatments, from the same `panelBevels`
 * the 3D view and the kernel are built from. Without it a panel is a box,
 * which is what the isometric drew before and what a filleted box is not.
 */
export function buildIsometric(sol, { explode = 0, fittingsOn = null, bevelsOf = null } = {}) {
  const groups = [];

  for (const { panel, index, box, visible, quads } of isoSurfaces(sol, { explode, bevelsOf })) {
    const holes = fittingsOn ? panelHoles(panel, box, fittingsOn(panel)) : [];
    groups.push({ panel, visible, holes, edges: panelLines(quads) });
  }

  const all = groups.flatMap((g) => [
    ...g.visible.flatMap((q) => q.pts.map(isoProject)),
    ...g.edges.flatMap(([u, v]) => [isoProject(u), isoProject(v)]),
    ...g.holes.flatMap((h) => h.pts),
  ]);
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const min = { x: Math.min(...xs), y: Math.min(...ys) };
  const ext = { h: Math.max(...xs) - min.x, v: Math.max(...ys) - min.y };
  const to = (p) => [p.x - min.x, p.y - min.y];
  const flat = (v) => to(isoProject(v));

  return {
    view: "iso", ext, arcs: [], hatches: [], lines: [],
    // Drawn in this order and no other: each panel's fills, then its own
    // lines, then the next panel over the top of them.
    groups: groups.map((g) => ({
      // Which panel this is, so the drawing can be read back: the mitred front
      // runs to the corner where the butted one stops a thickness short of it,
      // and that is a difference in one face of one panel.
      face: g.panel.face, layer: g.panel.layer,
      fills: g.visible.map((q) => ({ axis: q.axis, pts: q.pts.map(flat) })),
      lines: [
        ...g.edges.map(([u, v]) => ({ pts: [flat(u), flat(v)], closed: false })),
        ...g.holes.map((h) => ({ pts: h.pts.map(to), closed: h.closed })),
      ],
    })),
  };
}
