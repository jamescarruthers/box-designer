// §6.5 Section A–A. Outline views cannot show a laminated wall.

import { PROJECTIONS, hiddenLineRemoval, segEnds, VIEW_EXTENT } from "./hlr.js";

export const HATCH = {
  shell:    { id: "hatch-carcass",  angle: 45,  pitch: 2.2, label: "CARCASS" },
  doubler:  { id: "hatch-doubler",  angle: -45, pitch: 2.2, label: "DOUBLER" },
  cladding: { id: "hatch-cladding", angle: 45,  pitch: 1.2, label: "CLADDING" },
};

/**
 * Cut a vertical plane at x = cx, viewed from the left. Sections omit hidden
 * detail, so only visible segments survive.
 */
export function buildSection(sol, cx = sol.E.x / 2) {
  const ext = VIEW_EXTENT.end(sol.E);
  const cut = sol.panels.filter((p) => p.box.x[0] < cx && cx < p.box.x[1]);
  const beyond = sol.panels.filter((p) => p.box.x[0] >= cx);

  const rects = [...cut, ...beyond].map((p) => ({
    ...PROJECTIONS.end(p.box, sol.E),
    n: Math.max(p.box.x[0], cx),
    panel: p,
  }));

  const lines = hiddenLineRemoval(rects)
    .filter((s) => s.visible)
    .map((s) => { const [a, b] = segEnds(s); return { a, b, visible: true, kind: "hlr" }; });

  const hatches = cut.map((p) => {
    const r = PROJECTIONS.end(p.box, sol.E);
    return { panel: p, h: r.h, v: r.v, hatch: HATCH[p.layer] };
  });

  return { view: "section", ext, cx, lines, arcs: [], hatches };
}

/** §6.5 The cutting-plane symbol goes on the plan, not the front elevation. */
export function cuttingPlaneOnPlan(sol, cx) {
  const ext = VIEW_EXTENT.plan(sol.E);
  return { h: cx, v0: 0, v1: ext.v, letter: "A", ext };
}
