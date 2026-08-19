// §6.3 steps 4 and 5, applied to what the kernel emits.
//
// HLRBRep runs over a compound of six or more separate solids, so it returns
// every panel's own outline: where two panels abut, both report the joint, and
// a hidden line often lies exactly under a visible one. The analytic engine
// deduped and merged as part of its algorithm; the kernel leaves it to us.
//
// Every panel is an axis-aligned box, so once projected its sharp edges are
// axis-aligned too and the tested machinery of src/drawing/hlr.js applies
// unchanged. Only the bevel curves are neither, and those are deduped by
// endpoint alone.

import { mergeRuns } from "../drawing/hlr.js";

const GRID = 1e-6;
const q = (v) => Math.round(v / GRID) * GRID;
const same = (a, b) => Math.abs(a - b) < GRID;

/** Split a segment list into the axis-aligned ones and everything else. */
function classify(lines) {
  const axial = [], free = [];
  for (const l of lines) {
    const [h1, v1] = l.a, [h2, v2] = l.b;
    if (same(v1, v2) && !same(h1, h2)) {
      axial.push({ orient: "h", fixed: q(v1), a: q(Math.min(h1, h2)), b: q(Math.max(h1, h2)), visible: l.visible, kind: l.kind });
    } else if (same(h1, h2) && !same(v1, v2)) {
      axial.push({ orient: "v", fixed: q(h1), a: q(Math.min(v1, v2)), b: q(Math.max(v1, v2)), visible: l.visible, kind: l.kind });
    } else if (!same(h1, h2) || !same(v1, v2)) {
      free.push(l);
    }
  }
  return { axial, free };
}

/** Cut every segment on a given line at every endpoint on that line, so overlaps become identical or disjoint. */
function splitOnLine(segs) {
  const cuts = [...new Set(segs.flatMap((s) => [s.a, s.b]))].sort((x, y) => x - y);
  const out = [];
  for (const s of segs) {
    const pts = cuts.filter((c) => c >= s.a - GRID && c <= s.b + GRID);
    for (let i = 0; i + 1 < pts.length; i++) {
      if (pts[i + 1] - pts[i] > GRID) out.push({ ...s, a: pts[i], b: pts[i + 1] });
    }
  }
  return out;
}

/**
 * Dedupe and merge. A hidden segment lying under a visible one is dropped:
 * convention draws the visible one, and in a box that happens constantly.
 */
export function mergeViewLines(lines) {
  const { axial, free } = classify(lines);

  const byLine = new Map();
  for (const s of axial) {
    const k = `${s.orient}|${s.fixed}`;
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k).push(s);
  }

  const resolved = [];
  for (const segs of byLine.values()) {
    const seen = new Map();
    for (const s of splitOnLine(segs)) {
      const k = `${s.a}|${s.b}`;
      const prev = seen.get(k);
      if (!prev || (s.visible && !prev.visible)) seen.set(k, s);
    }
    resolved.push(...seen.values());
  }

  const merged = mergeRuns(resolved);

  const seenFree = new Map();
  for (const l of free) {
    const [p, r] = [l.a, l.b].map(([h, v]) => `${q(h)},${q(v)}`).sort();
    const k = `${p}|${r}`;
    const prev = seenFree.get(k);
    if (!prev || (l.visible && !prev.visible)) seenFree.set(k, l);
  }

  return {
    lines: [
      ...merged.map((s) => ({
        a: s.orient === "h" ? [s.a, s.fixed] : [s.fixed, s.a],
        b: s.orient === "h" ? [s.b, s.fixed] : [s.fixed, s.b],
        visible: s.visible, kind: "hlr",
      })),
      ...seenFree.values(),
    ],
    arcs: [],
  };
}

/** Format a view's lines the way the §6.3 fixtures read, for comparing engines. */
export function describe(lines) {
  return lines
    .filter((l) => same(l.a[1], l.b[1]) || same(l.a[0], l.b[0]))
    .map((l) => {
      const horiz = same(l.a[1], l.b[1]);
      const fixed = horiz ? l.a[1] : l.a[0];
      const [lo, hi] = horiz ? [l.a[0], l.b[0]] : [l.a[1], l.b[1]];
      return `${l.visible ? "solid " : "dashed"} ${horiz ? "horiz" : "vert "} ${+fixed.toFixed(6)} ${+Math.min(lo, hi).toFixed(6)}..${+Math.max(lo, hi).toFixed(6)}`;
    })
    .sort();
}
