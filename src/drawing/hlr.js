// §6.2 projections and §6.3 hidden line removal.
// Every panel is an axis-aligned box, so it projects to a rectangle and
// visibility is exact — no tolerance anywhere.

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
  return panels.map((panel) => ({ ...p(panel.box, E), panel }));
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
    for (const v of r.v) for (const [a, b] of split(r.h, hCuts)) raw.push({ orient: "h", fixed: v, a, b, n: r.n });
    for (const h of r.h) for (const [a, b] of split(r.v, vCuts)) raw.push({ orient: "v", fixed: h, a, b, n: r.n });
  }

  // 3. Hidden when a strictly nearer rectangle strictly contains the midpoint.
  for (const s of raw) {
    const mid = (s.a + s.b) / 2;
    const [mh, mv] = s.orient === "h" ? [mid, s.fixed] : [s.fixed, mid];
    s.visible = !live.some((r) =>
      r.n < s.n && r.h[0] < mh && mh < r.h[1] && r.v[0] < mv && mv < r.v[1]);
  }

  // 4. Dedupe; visible wins.
  const seen = new Map();
  for (const s of raw) {
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
