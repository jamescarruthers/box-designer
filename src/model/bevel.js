// §3 Edge treatments. Cut from the outer face, inward. Blank sizes unchanged.

import { AXIS, PAIR, AXES, EDGES, edgeKey, edgeAxis } from "./constants.js";

export const TREATMENTS = ["none", "chamfer", "fillet"];

/** inset(0) = R, inset(R) = 0, measured inward from the outer face. */
export function insetAt(type, R, d) {
  if (!(R > 0) || type === "none") return 0;
  if (d >= R) return 0;
  if (type === "chamfer") return R - d;
  return R - Math.sqrt(Math.max(0, 2 * R * d - d * d));   // fillet
}

/** Depths sampled from the outer face inward. One step for a chamfer, eight for a fillet. */
export function bevelDepths(type, R) {
  if (!(R > 0) || type === "none") return [0];
  const n = type === "chamfer" ? 1 : 8;
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
 * Per-panel bevels: for each of a panel's four planar sides, the treatment of
 * the envelope edge it lies on, when this panel owns that edge.
 * Returns { [sideFace]: {type, radius} }.
 */
export function panelBevels(panelIndex, panel, edges, owners) {
  const a = AXIS[panel.face][0];
  const out = {};
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

/** A short note for the cut list, e.g. "R12 top, chamfer 6 left". */
export function panelEdgeNote(bevels) {
  const parts = Object.entries(bevels).map(([g, t]) =>
    t.type === "fillet" ? `R${t.radius} ${g}` : `CH${t.radius} ${g}`);
  return parts.join(", ");
}
