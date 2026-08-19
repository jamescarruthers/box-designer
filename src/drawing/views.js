// §6.4 Edge treatments in the orthographic views.

import { EDGES, edgeKey } from "../model/constants.js";
import { viewLines, VIEW_EXTENT, segEnds } from "./hlr.js";

/** Which side of each view a face falls on. */
export const FACE_SIDE = {
  front: { left: ["h", 0], right: ["h", 1], top: ["v", 0], bottom: ["v", 1] },
  end:   { back: ["h", 0], front: ["h", 1], top: ["v", 0], bottom: ["v", 1] },
  plan:  { left: ["h", 0], right: ["h", 1], back: ["v", 0], front: ["v", 1] },
};

/** The face nearest the viewer in each view — it decides a tangent line's visibility. */
const NEAR_FACE = { front: "front", end: "left", plan: "top" };

const sideCoord = (axis, idx, ext) => (idx === 0 ? 0 : axis === "h" ? ext.h : ext.v);

const treated = (t) => t && t.type !== "none" && t.radius > 0;

/**
 * Classify each of the twelve edges for one view.
 * Both faces on this view's sides → a cut corner; exactly one → a tangent line.
 */
export function classifyEdges(view, edges, ext) {
  const map = FACE_SIDE[view];
  const corners = [], tangents = [];
  for (const key of EDGES) {
    const t = edges[key];
    if (!treated(t)) continue;
    const [f1, f2] = key.split("|");
    const s1 = map[f1], s2 = map[f2];
    if (s1 && s2) {
      const [hs, vs] = s1[0] === "h" ? [s1, s2] : [s2, s1];
      corners.push({
        key, t,
        ch: sideCoord("h", hs[1], ext), cv: sideCoord("v", vs[1], ext),
        dh: hs[1] === 0 ? 1 : -1, dv: vs[1] === 0 ? 1 : -1,
      });
    } else if (s1 || s2) {
      const [g, s] = s1 ? [f1, s1] : [f2, s2];
      const other = s1 ? f2 : f1;                       // the near/far face
      tangents.push({ key, t, face: g, axis: s[0], idx: s[1], other,
        near: other === NEAR_FACE[view] });
    }
  }
  return { corners, tangents };
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/** Trim the outline segments back by R at every cut corner. */
function trimOutline(segs, corners) {
  const out = segs.map((s) => ({ ...s }));
  for (const c of corners) {
    const R = c.t.radius;
    for (const s of out) {
      if (s.orient === "h" && near(s.fixed, c.cv)) {
        if (c.dh > 0 && near(s.a, c.ch)) s.a += R;
        else if (c.dh < 0 && near(s.b, c.ch)) s.b -= R;
      } else if (s.orient === "v" && near(s.fixed, c.ch)) {
        if (c.dv > 0 && near(s.a, c.cv)) s.a += R;
        else if (c.dv < 0 && near(s.b, c.cv)) s.b -= R;
      }
    }
  }
  return out.filter((s) => s.b - s.a > 1e-9);
}

/** How far a tangent line stops short at each end: the radius of the corner there. */
function tangentSpan(t, view, edges, ext) {
  const map = FACE_SIDE[view];
  const runAxis = t.axis === "h" ? "v" : "h";
  const ends = Object.entries(map).filter(([, s]) => s[0] === runAxis)
    .sort((a, b) => a[1][1] - b[1][1]);
  const trim = ends.map(([f]) => {
    const e = edges[edgeKey(t.face, f)];
    return treated(e) ? e.radius : 0;
  });
  const len = runAxis === "h" ? ext.h : ext.v;
  return [trim[0], len - trim[1]];
}

/**
 * Build one orthographic view: HLR lines, plus corner arcs/diagonals and
 * chamfer tangent lines. A fillet gets no tangent line — it meets the flat
 * face tangentially, so there is no edge there and ISO 128 omits it.
 */
export function buildOrthoView(view, sol, edges) {
  const ext = VIEW_EXTENT[view](sol.E);
  const { corners, tangents } = classifyEdges(view, edges, ext);
  const segs = trimOutline(viewLines(sol.panels, view, sol.E), corners);

  const lines = segs.map((s) => {
    const [a, b] = segEnds(s);
    return { a, b, visible: s.visible, kind: "hlr" };
  });
  const arcs = [];

  for (const c of corners) {
    const R = c.t.radius;
    const p1 = [c.ch + c.dh * R, c.cv];
    const p2 = [c.ch, c.cv + c.dv * R];
    if (c.t.type === "fillet") {
      arcs.push({ from: p1, to: p2, r: R, sweep: c.dh * c.dv > 0 ? 0 : 1, key: c.key });
    } else {
      lines.push({ a: p1, b: p2, visible: true, kind: "chamfer-corner", key: c.key });
    }
  }

  // Chamfer only: a line inset from the outline by the leg length.
  const seen = new Map();
  for (const t of tangents) {
    if (t.t.type !== "chamfer") continue;
    const R = t.t.radius;
    const len = t.axis === "h" ? ext.h : ext.v;
    const fixed = t.idx === 0 ? R : len - R;
    const [s0, s1] = tangentSpan(t, view, edges, ext);
    if (s1 - s0 <= 1e-9) continue;
    const a = t.axis === "h" ? [fixed, s0] : [s0, fixed];
    const b = t.axis === "h" ? [fixed, s1] : [s1, fixed];
    const k = `${t.axis}|${fixed}|${s0}|${s1}`;
    const prev = seen.get(k);
    if (!prev || (t.near && !prev.visible)) seen.set(k, { a, b, visible: t.near, kind: "chamfer-tangent", key: t.key });
  }
  lines.push(...seen.values());

  return { view, ext, lines, arcs };
}
