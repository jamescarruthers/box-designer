// §6.5 Section A–A. Outline views cannot show a laminated wall.

import { PROJECTIONS, hiddenLineRemoval, segEnds, VIEW_EXTENT } from "./hlr.js";
import { mitresInView, trimMitres } from "./views.js";

export const HATCH = {
  shell:    { id: "hatch-carcass",  angle: 45,  pitch: 2.2, label: "CARCASS" },
  doubler:  { id: "hatch-doubler",  angle: -45, pitch: 2.2, label: "DOUBLER" },
  cladding: { id: "hatch-cladding", angle: 45,  pitch: 1.2, label: "CLADDING" },
  // §30 A lining is not a board and should not read as one in section. Widely
  // spaced and the other way up, so a felted wall is told from a doubled one at
  // a glance rather than by counting lines.
  lagging:  { id: "hatch-lagging",  angle: -45, pitch: 4.5, label: "LAGGING" },
};

/**
 * Cut a vertical plane at x = cx, viewed from the left. Sections omit hidden
 * detail, so only visible segments survive.
 */
export function buildSection(sol, cx = sol.E.x / 2) {
  const ext = VIEW_EXTENT.end(sol.E);
  // §12 The section is the end view, so mitres resolve the same way here.
  const mitred = mitresInView("end", sol.panels, ext);
  const cut = mitred.panels.filter((p) => p.box.x[0] < cx && cx < p.box.x[1]);
  const beyond = mitred.panels.filter((p) => p.box.x[0] >= cx);

  const rects = [...cut, ...beyond].map((p) => ({
    ...PROJECTIONS.end(p.box, sol.E),
    n: Math.max(p.box.x[0], cx),
    panel: p,
  }));

  const trimmed = trimMitres(hiddenLineRemoval(rects), mitred.corners);
  const lines = trimmed.segs
    .filter((s) => s.visible)
    .map((s) => { const [a, b] = segEnds(s); return { a, b, visible: true, kind: "hlr" }; });
  lines.push(...trimmed.lines.filter((l) => l.visible));

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
