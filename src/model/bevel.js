// §3 Edge treatments. Cut from the outer face, inward. Blank sizes unchanged.

import { AXIS, PAIR, AXES, EDGES, edgeKey, edgeAxis } from "./constants.js";
import { mitreBevels } from "./mitre.js";

export const TREATMENTS = ["none", "chamfer", "fillet"];

/**
 * inset(0) = R, inset(R) = 0, measured inward from the outer face.
 *
 * §12 A mitre runs the other way: the outer face keeps the corner and the cut
 * opens out toward the inner one, reaching its leg at full depth. Same family,
 * same machinery, opposite sign.
 */
export function insetAt(type, R, d) {
  if (!(R > 0) || type === "none") return 0;
  if (type === "mitre") return Math.min(d, R);
  if (d >= R) return 0;
  if (type === "chamfer") return R - d;
  return R - Math.sqrt(Math.max(0, 2 * R * d - d * d));   // fillet
}

/** Depths sampled from the outer face inward. One step for a chamfer, eight for a fillet. */
export function bevelDepths(type, R) {
  if (!(R > 0) || type === "none") return [0];
  const n = type === "fillet" ? 8 : 1;   // a mitre, like a chamfer, is one plane
  return Array.from({ length: n + 1 }, (_, i) => (R * i) / n);
}

export const noEdges = () =>
  Object.fromEntries(EDGES.map((k) => [k, { type: "none", radius: 0 }]));

export function uniformEdges(type, radius) {
  return Object.fromEntries(EDGES.map((k) => [k, { type, radius }]));
}

/** The point just inside the material at an edge, used to find which panel owns it. */
export function edgeProbe(env, key, eps = 1e-6) {
  const [f1, f2] = key.split("|");
  const run = edgeAxis(key);
  const p = {};
  p[run] = (env[run][0] + env[run][1]) / 2;
  for (const f of [f1, f2]) {
    const [a, s] = AXIS[f];
    p[a] = s < 0 ? env[a][0] + eps : env[a][1] - eps;
  }
  return p;
}

const contains = (b, p) => AXES.every((k) => p[k] > b[k][0] && p[k] < b[k][1]);

/**
 * §3: a bevel attaches to a panel only where that panel is the outermost
 * material at that edge. Found geometrically, so cladding takes it over
 * automatically. Returns { edgeKey: panelIndex }.
 */
export function edgeOwners(env, panels) {
  const owners = {};
  for (const key of EDGES) {
    const p = edgeProbe(env, key);
    const i = panels.findIndex((pan) => contains(pan.box, p));
    if (i >= 0) owners[key] = i;
  }
  return owners;
}

/**
 * §3 An edge treatment can only be cut where one panel runs the edge's whole
 * length. Where the outermost material changes partway along — the left panel
 * in the middle, the front and back panels at its ends — a fillet would die
 * into the side of the next panel, so that edge stays square.
 *
 * The owner is found at the edge's midpoint, so the edge is full length exactly
 * when the owner spans the envelope along the axis the edge runs. Panel bounds
 * are copied from the envelope's when no inset applies, so this is exact.
 */
export function fullLengthEdges(env, panels, owners) {
  const out = {};
  for (const key of EDGES) {
    const i = owners[key];
    if (i == null) { out[key] = false; continue; }
    const a = edgeAxis(key);
    const b = panels[i].box[a];
    out[key] = b[0] === env[a][0] && b[1] === env[a][1];
  }
  return out;
}

/** The requested treatments, with the ones that cannot be cut left square. */
/**
 * §26 Whether a bevel fits in the material it would be cut from.
 *
 * A fillet of R30 on an 18 mm wall does not take a corner off — it removes the
 * corner and keeps going, and there is no solid left for it to run round. The
 * app has always called that an error (`bevelIssues`), but an error was only
 * ever a sentence: the impossible bevel went to the kernel anyway, OCCT refused
 * the shape, and it refused it by throwing.
 *
 * A mitre is exempt. It is a joint rather than a decoration and its leg is the
 * thickness by definition, so it can never be too big for it.
 */
/**
 * §26 A bevel has to leave material behind it.
 *
 * Measured rather than assumed: sweeping the radius against the wall, every
 * fraction up to 0.9 cuts and the wall thickness exactly does not — on a 12 mm
 * wall and an 18 mm one, fillet and chamfer alike. Which stands to reason. A
 * fillet whose radius is the whole thickness takes the corner away entirely and
 * leaves OCCT nothing to run the surface over, and it says so: *exception of
 * type StdFail_NotDone*.
 *
 * Half a millimetre of margin, which is the smallest step the control offers,
 * so the largest radius the box will take is also a number somebody can type.
 */
export const BEVEL_MARGIN = 0.5;

/** The largest radius one edge can take: the thinner of its two walls, less the margin. */
export function largestBevelAt(wall, key) {
  const [f1, f2] = key.split("|");
  const w = Math.min(wall?.[f1] ?? Infinity, wall?.[f2] ?? Infinity);
  return Number.isFinite(w) ? Math.max(0, w - BEVEL_MARGIN) : Infinity;
}

export function bevelFits(key, t, wall) {
  if (!wall) return true;
  if (!t || t.type === "none" || t.type === "mitre" || !(t.radius > 0)) return true;
  return t.radius <= largestBevelAt(wall, key) + 1e-9;
}

/** The largest radius every edge of the box could take. */
export function largestBevel(wall) {
  const walls = Object.values(wall ?? {}).filter((w) => Number.isFinite(w) && w > 0);
  return walls.length ? Math.max(0, Math.min(...walls) - BEVEL_MARGIN) : Infinity;
}

/**
 * The treatments that will actually be cut.
 *
 * Two reasons one is dropped, and both are "the material will not take it":
 * no single panel runs the whole length of the edge (§3), or the radius is
 * bigger than the wall it would cut through (§26). Dropped here rather than
 * argued about downstream, so nothing asks the kernel for a shape it cannot
 * build — the messages still say what was left square and why.
 */
export function applicableEdges(edges, full, wall = null) {
  return Object.fromEntries(EDGES.map((k) => {
    const t = edges[k];
    const cut = t && full[k] && bevelFits(k, t, wall);
    return [k, cut ? t : { type: "none", radius: 0 }];
  }));
}

/** §8 Tell the user which requested treatments were dropped, and why. */
export function partialEdgeIssues(edges, full) {
  const dropped = EDGES.filter((k) => {
    const t = edges[k];
    return t && t.type !== "none" && t.radius > 0 && !full[k];
  });
  if (!dropped.length) return [];
  return [{
    level: "warning",
    text: `Left square: ${dropped.map((k) => k.replace("|", "/")).join(", ")}. ` +
      "No single panel runs the whole length of these edges, so a bevel would " +
      "stop against the side of the next panel. Reorder prominence to change which edges are continuous.",
  }];
}

/**
 * Per-panel bevels: for each of a panel's four planar sides, the treatment of
 * the envelope edge it lies on, when this panel owns that edge.
 * Returns { [sideFace]: {type, radius} }.
 */
export function panelBevels(panelIndex, panel, edges, owners) {
  const a = AXIS[panel.face][0];
  // §12 Mitres belong to the panel rather than to the envelope edge — both
  // panels of a mitred joint are cut, not just whichever owns the outer corner.
  const out = mitreBevels(panel);
  for (const b of AXES) {
    if (b === a) continue;
    for (const g of PAIR[b]) {
      const key = edgeKey(panel.face, g);
      const t = edges[key];
      if (!t || t.type === "none" || !(t.radius > 0)) continue;
      if (owners[key] !== panelIndex) continue;
      out[g] = t;
    }
  }
  return out;
}

/** §3 Validation: a bevel must not cut through the wall, nor past the outer skin. */
export function bevelIssues(edges, wall, skin) {
  const issues = [];
  for (const key of EDGES) {
    const t = edges[key];
    if (!t || t.type === "none" || !(t.radius > 0)) continue;
    const [f1, f2] = key.split("|");
    const w = Math.min(wall[f1], wall[f2]);
    const s = Math.min(skin[f1], skin[f2]);
    if (t.radius > w) {
      issues.push({ level: "error", key,
        text: `Edge ${f1}/${f2}: R${t.radius} cuts through the ${w} mm wall.` });
    } else if (t.radius > s) {
      issues.push({ level: "warning", key,
        text: `Edge ${f1}/${f2}: R${t.radius} cuts past the ${s} mm outer skin — the glue line will show.` });
    }
  }
  return issues;
}

/** A short note for the cut list: sides sharing a treatment are listed together. */
export function panelEdgeNote(bevels) {
  const groups = new Map();
  for (const [g, t] of Object.entries(bevels)) {
    const k = t.type === "fillet" ? `R${t.radius}` : t.type === "mitre" ? "45°" : `CH${t.radius}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(g);
  }
  return [...groups.entries()].map(([k, sides]) =>
    // A panel has four sides; all four alike is the common case and reads better short.
    `${k} ${sides.length === 4 ? "all" : sides.join(", ")}`).join("; ");
}

/**
 * §48 Which edge of the blank each of a panel's treatments falls on.
 *
 * A bevel is named by the face across the corner from it, which is how the box
 * thinks about it and no use at all to somebody holding the board. A blank is a
 * rectangle with two ends and two long edges, and what they need to know is
 * which of the four the saw is set over for.
 *
 * The blank's frame is `toBlank`'s (§10): x along the length from the low end
 * of the length axis, y **down** from the top. That y is flipped so a template
 * laid on the board is not mirrored — which means the *high* end of the width
 * axis is the top of the blank, and this is the one place that has to remember
 * it.
 *
 * Returns each treatment with the side it lands on and the segment it runs
 * along, in blank coordinates, so a drawing can mark the edge rather than
 * describe it.
 */
export function blankBevels(panel, bevels, blank) {
  const order = { top: 0, bottom: 1, left: 2, right: 3 };
  const out = [];
  for (const [face, t] of Object.entries(bevels ?? {})) {
    if (!t || t.type === "none") continue;
    const [axis, sign] = AXIS[face] ?? [];
    const side = axis === blank.lengthAxis ? (sign < 0 ? "left" : "right")
      : axis === blank.widthAxis ? (sign > 0 ? "top" : "bottom")
      : null;
    // A panel's own thickness axis has no edge on the blank — nothing is ever
    // filed under it, and a treatment that somehow named it is not this
    // board's business.
    if (!side) continue;
    const { length: L, width: W } = blank;
    const seg = side === "top" ? [[0, 0], [L, 0]]
      : side === "bottom" ? [[0, W], [L, W]]
      : side === "left" ? [[0, 0], [0, W]]
      : [[L, 0], [L, W]];
    out.push({ side, face, type: t.type, radius: t.radius, seg });
  }
  return out.sort((a, b) => order[a.side] - order[b.side]);
}
