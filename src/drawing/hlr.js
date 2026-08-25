// §6.2 projections and §6.3 hidden line removal.
// Every panel is an axis-aligned box, so it projects to a rectangle and
// visibility is exact — no tolerance anywhere. §42 A panel with a groove cut
// in it is not one box, but it is a handful of them, and the same is true of
// each.

import { subtractBoxes } from "../model/rebate.js";

/** b → { h:[lo,hi], v:[lo,hi], n } with n the nearness; smaller is nearer. */
export const PROJECTIONS = {
  front: (b, E) => ({ h: [b.x[0], b.x[1]], v: [E.z - b.z[1], E.z - b.z[0]], n: b.y[0] }),
  end:   (b, E) => ({ h: [E.y - b.y[1], E.y - b.y[0]], v: [E.z - b.z[1], E.z - b.z[0]], n: b.x[0] }),
  plan:  (b, E) => ({ h: [b.x[0], b.x[1]], v: [E.y - b.y[1], E.y - b.y[0]], n: E.z - b.z[1] }),
};

export const VIEW_EXTENT = {
  front: (E) => ({ h: E.x, v: E.z }),
  end:   (E) => ({ h: E.y, v: E.z }),
  plan:  (E) => ({ h: E.x, v: E.y }),
};

export function projectPanels(panels, view, E) {
  const p = PROJECTIONS[view];
  // §42 A grooved panel goes in as the pieces it is left in, all carrying the
  // panel itself — so the groove shows as hidden detail and the joins between
  // the pieces do not show at all.
  return panels.flatMap((panel) =>
    subtractBoxes(panel.box, panel.notches).map((piece) => ({ ...p(piece, E), panel })));
}

const uniqSorted = (xs) => [...new Set(xs)].sort((a, b) => a - b);

/**
 * Hidden line removal over a set of projected rectangles.
 * Returns [{ orient:"h"|"v", fixed, a, b, visible }] — merged collinear runs.
 */
export function hiddenLineRemoval(rects) {
  const live = rects.filter((r) => r.h[1] > r.h[0] && r.v[1] > r.v[0]);
  const hCuts = uniqSorted(live.flatMap((r) => r.h));
  const vCuts = uniqSorted(live.flatMap((r) => r.v));

  // 1 + 2. Boundary segments, split at every rectangle boundary coordinate.
  const raw = [];
  for (const r of live) {
    for (const v of r.v) for (const [a, b] of split(r.h, hCuts)) raw.push({ orient: "h", fixed: v, a, b, n: r.n, panel: r.panel });
    for (const h of r.h) for (const [a, b] of split(r.v, vCuts)) raw.push({ orient: "v", fixed: h, a, b, n: r.n, panel: r.panel });
  }

  // 3. Hidden when a strictly nearer rectangle strictly contains the midpoint.
  for (const s of raw) {
    const mid = (s.a + s.b) / 2;
    const [mh, mv] = s.orient === "h" ? [mid, s.fixed] : [s.fixed, mid];
    s.visible = !live.some((r) =>
      r.n < s.n && r.h[0] < mh && mh < r.h[1] && r.v[0] < mv && mv < r.v[1]);
  }

  // §42 3b. A board with a groove in it arrives as two or three rectangles at
  // the same depth, and the joins between them are not edges of anything —
  // they are lines through the middle of one board. Dropped where the same
  // panel lies on both sides of the segment at the same depth.
  const solid = raw.filter((s) => s.panel);
  if (solid.length) {
    const EPS = 1e-7;
    for (const s of raw) {
      if (!s.panel || !s.visible) continue;
      const mid = (s.a + s.b) / 2;
      const covers = (dh, dv) => {
        const [mh, mv] = s.orient === "h" ? [mid + dh, s.fixed + dv] : [s.fixed + dh, mid + dv];
        return live.some((r) => r.panel === s.panel && r.n === s.n &&
          r.h[0] < mh && mh < r.h[1] && r.v[0] < mv && mv < r.v[1]);
      };
      const [dh, dv] = s.orient === "h" ? [0, EPS] : [EPS, 0];
      if (covers(dh, dv) && covers(-dh, -dv)) s.visible = null;    // neither seen nor hidden
    }
  }

  // 4. Dedupe; visible wins.
  const seen = new Map();
  for (const s of raw) {
    if (s.visible === null) continue;
    const k = `${s.orient}|${s.fixed}|${s.a}|${s.b}`;
    const prev = seen.get(k);
    if (!prev) seen.set(k, s);
    else if (s.visible && !prev.visible) seen.set(k, s);
  }

  return mergeRuns([...seen.values()]);
}

function split([lo, hi], cuts) {
  const pts = [lo, ...cuts.filter((c) => c > lo && c < hi), hi];
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i], pts[i + 1]]);
  return out;
}

/** 5. Merge collinear runs sharing orientation, position and visibility. */
export function mergeRuns(segs) {
  const groups = new Map();
  for (const s of segs) {
    const k = `${s.orient}|${s.fixed}|${s.visible}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const out = [];
  for (const g of groups.values()) {
    g.sort((x, y) => x.a - y.a);
    let cur = null;
    for (const s of g) {
      if (cur && s.a <= cur.b) cur.b = Math.max(cur.b, s.b);
      else { if (cur) out.push(cur); cur = { orient: s.orient, fixed: s.fixed, a: s.a, b: s.b, visible: s.visible }; }
    }
    if (cur) out.push(cur);
  }
  return out.sort((x, y) =>
    x.orient.localeCompare(y.orient) || x.fixed - y.fixed || x.a - y.a);
}

/** Convenience: HLR for one of the three orthographic views. */
export function viewLines(panels, view, E) {
  return hiddenLineRemoval(projectPanels(panels, view, E));
}

/** Segment endpoints in view coordinates. */
export const segEnds = (s) => s.orient === "h"
  ? [[s.a, s.fixed], [s.b, s.fixed]]
  : [[s.fixed, s.a], [s.fixed, s.b]];
