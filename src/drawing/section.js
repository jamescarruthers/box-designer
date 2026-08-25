// §6.5 Section A–A. Outline views cannot show a laminated wall.

import { subtractBoxes } from "../model/rebate.js";
import { PROJECTIONS, hiddenLineRemoval, segEnds, VIEW_EXTENT } from "./hlr.js";
import { mitresInView, trimMitres } from "./views.js";

export const HATCH = {
  shell:    { id: "hatch-carcass",  angle: 45,  pitch: 2.2, label: "CARCASS" },
  doubler:  { id: "hatch-doubler",  angle: -45, pitch: 2.2, label: "DOUBLER" },
  cladding: { id: "hatch-cladding", angle: 45,  pitch: 1.2, label: "CLADDING" },
  // §32 Not another line hatch.
  //
  // A lining had 45° lines like the boards either side of it, wider apart —
  // which is a difference you have to measure rather than see, and at 1:5 on a
  // 10 mm felt it is two lines against three. Stipple is the drawing
  // convention for a loose fill and it reads as one instantly: no direction to
  // confuse with a board's, and nothing to count.
  lagging:  { id: "hatch-lagging",  kind: "dots", pitch: 1.6, r: 0.28, label: "LAGGING" },
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

  // §42 A board with a groove cut in it is not a rectangle in section. Each
  // piece of it is, though, so it goes in as the pieces — all carrying the
  // same panel, which is what stops the joins between them being drawn as
  // lines through the middle of a board.
  const rects = [...cut, ...beyond].flatMap((p) =>
    subtractBoxes(p.box, p.notches).map((piece) => ({
      ...PROJECTIONS.end(piece, sol.E),
      n: Math.max(piece.x[0], cx),
      panel: p,
    })));

  const trimmed = trimMitres(hiddenLineRemoval(rects), mitred.corners);
  const lines = trimmed.segs
    .filter((s) => s.visible)
    .map((s) => { const [a, b] = segEnds(s); return { a, b, visible: true, kind: "hlr" }; });
  lines.push(...trimmed.lines.filter((l) => l.visible));

  // §42 Hatched piece by piece as well, so the groove reads as an absence of
  // board rather than as board with a line drawn on it.
  const hatches = cut.flatMap((p) =>
    subtractBoxes(p.box, p.notches).map((piece) => {
      const r = PROJECTIONS.end(piece, sol.E);
      return { panel: p, h: r.h, v: r.v, hatch: HATCH[p.layer] };
    }));

  return { view: "section", ext, cx, lines, arcs: [], hatches };
}

/** §6.5 The cutting-plane symbol goes on the plan, not the front elevation. */
export function cuttingPlaneOnPlan(sol, cx) {
  const ext = VIEW_EXTENT.plan(sol.E);
  return { h: cx, v0: 0, v1: ext.v, letter: "A", ext };
}
