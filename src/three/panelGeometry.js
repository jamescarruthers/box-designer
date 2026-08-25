// §4 Panel geometry: a prism from inner to outer surface, tapered at any
// external edge carrying a bevel.

import { AXIS, PAIR, AXES } from "../model/constants.js";
import { insetAt, bevelDepths } from "../model/bevel.js";
import { EXPLODE_SCALE, explodeShift } from "../model/explode.js";
import { subtractBoxes } from "../model/rebate.js";
import { mitredCells } from "../model/mitre.js";

const EPS = 1e-9;

/**
 * §12 At full thickness every chamfer and fillet has run out to nothing, but a
 * mitre is at its widest: its leg is the whole thickness. So the inner ring is
 * not "zero inset" — it is the mitres alone.
 */
export const mitresOnly = (bevels) =>
  Object.fromEntries(Object.entries(bevels).filter(([, t]) => t && t.type === "mitre"));

/** The rectangle of a panel's cross-section at depth `d` inward from its outer face. */
export function ringAt(panel, bevels, d) {
  const a = AXIS[panel.face][0];
  const rect = {};
  for (const b of AXES) {
    if (b === a) continue;
    const [bm, bp] = PAIR[b];
    const im = bevels[bm] ? insetAt(bevels[bm].type, bevels[bm].radius, d) : 0;
    const ip = bevels[bp] ? insetAt(bevels[bp].type, bevels[bp].radius, d) : 0;
    let lo = panel.box[b][0] + im, hi = panel.box[b][1] - ip;
    if (lo >= hi) { const m = (lo + hi) / 2; lo = m; hi = m; }   // opposite insets cannot cross
    rect[b] = [lo, hi];
  }
  return rect;
}

/** Depths from the outer surface inward: every bevel's samples, then full thickness. */
export function ringDepths(panel, bevels) {
  const a = AXIS[panel.face][0];
  const T = panel.box[a][1] - panel.box[a][0];
  const set = new Set([0]);
  for (const t of Object.values(bevels))
    for (const d of bevelDepths(t.type, t.radius)) if (d < T - EPS) set.add(d);
  const ds = [...set].sort((u, v) => u - v);
  ds.push(T);                                     // final ring at full thickness
  return ds;
}

/**
 * §42 The depth the grooves start at, measured from the outer face.
 *
 * A rebate is a tongue slid in from inside the box, so the groove that takes
 * it is always in the panel's inner face and always the rebate's depth deep.
 * Everything shallower than this is the panel as it was.
 */
export function notchDepth(panel) {
  if (!panel.notches?.length) return null;
  const [a, s] = AXIS[panel.face];
  const inner = s < 0 ? panel.box[a][1] : panel.box[a][0];
  return Math.min(...panel.notches.map((n) => Math.abs(inner - (s < 0 ? n[a][0] : n[a][1]))));
}

/**
 * Build the solid in model coordinates.
 * Returns { verts: [[x,y,z],…], tris: [[i,j,k],…], centroid, refs }.
 *
 * §42 `refs` is what each triangle is turned outward against. A panel with no
 * groove in it is convex, and the panel's own centre settles every face; one
 * with a groove is not, so the boxes the grooved part is made of are each
 * turned against their own centre instead. Same rule, applied to the piece
 * that is actually convex.
 */
export function panelSolid(panel, bevels = {}) {
  const [a, s] = AXIS[panel.face];
  const [p, q] = AXES.filter((b) => b !== a);
  const T = panel.box[a][1] - panel.box[a][0];
  const groove = notchDepth(panel);
  // The loft stops where the grooves start, and the rest is built from boxes.
  // `groove` is measured from the inner face, the ring depths from the outer.
  const stop = groove === null ? T : T - groove;
  const depths = ringDepths(panel, bevels).filter((d) => d <= stop + EPS);
  if (!depths.some((d) => Math.abs(d - stop) < EPS)) depths.push(stop);
  depths.sort((u, v) => u - v);

  const verts = [], rings = [];
  for (const d of depths) {
    const rect = d >= T - EPS
      ? ringAt(panel, mitresOnly(bevels), T)       // final ring: mitres only
      : ringAt(panel, bevels, d);
    const coord = s < 0 ? panel.box[a][0] + d : panel.box[a][1] - d;
    // Four corners, consistently ordered around the rectangle.
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([ip, iq]) => {
      const v = {};
      v[a] = coord; v[p] = rect[p][ip]; v[q] = rect[q][iq];
      return [v.x, v.y, v.z];
    });
    const base = verts.length;
    verts.push(...corners);
    rings.push([base, base + 1, base + 2, base + 3]);
  }

  const tris = [];
  const quad = (i, j, k, l) => { tris.push([i, j, k], [i, k, l]); };
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let c = 0; c < 4; c++) {
      const d = (c + 1) % 4;
      quad(A[c], A[d], B[d], B[c]);
    }
  }
  const first = rings[0], last = rings[rings.length - 1];
  quad(first[0], first[1], first[2], first[3]);   // outer cap
  quad(last[0], last[1], last[2], last[3]);       // inner cap

  const centroid = [0, 1, 2].map((k) => verts.reduce((acc, v) => acc + v[k], 0) / verts.length);
  const refs = tris.map(() => centroid);

  // §42 The grooved part: what is left of the inner slab once the tongues that
  // slide into it are taken out. Cell by cell, each one a box of its own.
  if (groove !== null) {
    const slab = Object.fromEntries(AXES.map((b) => [b, [...panel.box[b]]]));
    slab[a] = s < 0 ? [panel.box[a][1] - groove, panel.box[a][1]]
                    : [panel.box[a][0], panel.box[a][0] + groove];
    for (const cell of subtractBoxes(slab, panel.notches)) {
      // §44 And the mitres are cut from the grooved part too. They were not,
      // and a panel that had both kept the corner the mitre should have taken
      // off it — a step where the loft stopped and the boxes began.
      const pieces = mitredCells(panel, cell);
      if (!pieces) { addPrism(verts, tris, refs, boxPrism(cell), a); continue; }
      for (const piece of pieces) addPrism(verts, tris, refs, piece, a);
    }
  }
  return { verts, tris, centroid, refs };
}

/**
 * §44 A box as a prism, so a mitred cell and a plain one are the same thing to
 * whatever draws them: a cross-section, and a length to extrude it along.
 */
function boxPrism(cell) {
  const [X, Y, Z] = AXES;
  return {
    axis: X, thick: Y, run: Z, at: cell[Z], length: cell[Z][1] - cell[Z][0],
    poly: [[cell[X][0], cell[Y][0]], [cell[X][1], cell[Y][0]],
      [cell[X][1], cell[Y][1]], [cell[X][0], cell[Y][1]]],
  };
}

/**
 * §44 One prism into the mesh: a cap at each end of the run and a quad down
 * each side of the cross-section. Turned outward against its own middle, which
 * is exact because a prism on a convex section is convex.
 */
function addPrism(verts, tris, refs, prism, _thickAxis) {
  const { axis, thick, run, at, poly } = prism;
  if (poly.length < 3) return;
  const base = verts.length;
  for (const end of [0, 1]) {
    for (const [u, v] of poly) {
      const p = { [axis]: u, [thick]: v, [run]: at[end] };
      verts.push([p.x, p.y, p.z]);
    }
  }
  const n = poly.length;
  const mid = [0, 0, 0];
  for (let i = base; i < verts.length; i++) for (let k = 0; k < 3; k++) mid[k] += verts[i][k] / (2 * n);
  const tri = (i, j, k) => { tris.push([i, j, k]); refs.push(mid); };
  for (let i = 1; i + 1 < n; i++) {
    tri(base, base + i, base + i + 1);                       // near cap
    tri(base + n, base + n + i, base + n + i + 1);           // far cap
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(base + i, base + j, base + n + j);
    tri(base + i, base + n + j, base + n + i);
  }
}

/** §4.3 model → three.js. A rotation, not an axis swap: determinant +1. */
export const toThree = (v, E) => [v[0] - E.x / 2, v[2] - E.z / 2, -(v[1] - E.y / 2)];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/**
 * §4.4 Orient every triangle outward against the panel centroid. A bevelled box
 * is convex, so dot(normal, triCentroid − panelCentroid) > 0 is exact.
 * Returns { positions: Float32Array, flipped, inward } in three coordinates.
 */
export function panelPositions(panel, bevels, E) {
  const { verts, tris, refs } = panelSolid(panel, bevels);
  const V = verts.map((v) => toThree(v, E));
  const c = [0, 1, 2].map((k) => V.reduce((acc, v) => acc + v[k], 0) / V.length);
  // §42 Each triangle is turned outward against the piece it belongs to, which
  // for everything but a grooved panel is the panel.
  const R = refs.map((r) => (r === undefined ? c : toThree(r, E)));

  const out = new Float32Array(tris.length * 9);
  let flipped = 0, o = 0;
  for (let t = 0; t < tris.length; t++) {
    let [i, j, k] = tris[t];
    const ref = R[t] ?? c;
    const n = cross(sub(V[j], V[i]), sub(V[k], V[i]));
    const m = [0, 1, 2].map((d) => (V[i][d] + V[j][d] + V[k][d]) / 3 - ref[d]);
    if (dot(n, m) < 0) { [j, k] = [k, j]; flipped++; }
    for (const idx of [i, j, k]) { out[o++] = V[idx][0]; out[o++] = V[idx][1]; out[o++] = V[idx][2]; }
  }
  return { positions: out, triangles: tris.length, flipped, centroid: c };
}

/** How many triangles still face inward after orientation — must be zero. */
export function inwardCount(positions, centroid) {
  let bad = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const P = [0, 1, 2].map((t) => [positions[i + t * 3], positions[i + t * 3 + 1], positions[i + t * 3 + 2]]);
    const n = cross(sub(P[1], P[0]), sub(P[2], P[0]));
    const m = [0, 1, 2].map((d) => (P[0][d] + P[1][d] + P[2][d]) / 3 - centroid[d]);
    if (dot(n, m) <= 0) bad++;
  }
  return bad;
}

/**
 * §4 The rings that are real edges, as line-segment pairs in three coordinates.
 *
 * `EdgesGeometry` finds creases by dihedral angle and so misses the boundary
 * where a fillet runs tangentially into the flat face it was cut from — the
 * wireframe ends up with a hole at every round-over, and the offset face has no
 * outline. These are the loops that are genuinely edges: the outer face, the
 * inner face, and the depth at which each bevel becomes tangent to its side.
 */
export function panelEdgeLoops(panel, bevels = {}, E) {
  const [a, s] = AXIS[panel.face];
  const [p, q] = AXES.filter((b) => b !== a);
  const T = panel.box[a][1] - panel.box[a][0];

  const depths = new Set([0, T]);
  for (const t of Object.values(bevels)) {
    if (t && t.type !== "none" && t.radius > 0 && t.radius < T) depths.add(t.radius);
  }

  const out = [];
  for (const d of [...depths].sort((u, v) => u - v)) {
    const rect = d >= T - EPS ? ringAt(panel, mitresOnly(bevels), T) : ringAt(panel, bevels, d);
    const coord = s < 0 ? panel.box[a][0] + d : panel.box[a][1] - d;
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([ip, iq]) => {
      const v = { [a]: coord, [p]: rect[p][ip], [q]: rect[q][iq] };
      return toThree([v.x, v.y, v.z], E);
    });
    for (let i = 0; i < 4; i++) out.push(corners[i], corners[(i + 1) % 4]);
  }

  const positions = new Float32Array(out.length * 3);
  out.forEach((c, i) => { positions.set(c, i * 3); });
  return positions;
}

// §4 Explode offsets, per layer, along the face normal. §38 The rule itself
// lives with the model, because the drawing's isometric explodes by it too.
export { EXPLODE_SCALE };

/** In three coordinates the normal is (x → s, z → s, y → −s). */
export function explodeOffset(panel, amount) {
  const d = explodeShift(panel, amount);
  return [d.x, d.z, d.y ? -d.y : 0];
}
