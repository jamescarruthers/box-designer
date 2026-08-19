// §6 The sheet, drawn by the kernel.
//
// The seam is `{ view, ext, lines, arcs }`: whatever produces it, sheet.js
// renders it. So the kernel becomes an alternative producer of the same shape
// and the frame, title block, scale selection, dimensions and hatching — all
// the things §11 notes OCCT does not give you — are untouched.

import { assembly } from "./solids.js";
import { viewGeometry } from "./hlr.js";
import { mergeViewLines } from "./merge.js";
import { VIEW_EXTENT } from "../drawing/hlr.js";
import { panelBevels } from "../model/bevel.js";
import { buildIsometric } from "../drawing/iso.js";
import { buildSection } from "../drawing/section.js";

/**
 * Build the three orthographic views with the kernel, keeping the section and
 * the isometric on the analytic path for now: the section needs a half-space
 * boolean and the isometric a silhouette pass, and neither is wired yet.
 */
export function kernelViews(oc, sol, edges, owners, { sectionAt, tangentEdges = false } = {}) {
  const shape = assembly(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners));
  const out = {};
  for (const view of ["front", "end", "plan"]) {
    const raw = viewGeometry(oc, shape, view, sol.E, { tangentEdges });
    out[view] = { view, ext: VIEW_EXTENT[view](sol.E), ...mergeViewLines(raw.lines), classes: raw.classes };
  }
  out.section = buildSection(sol, sectionAt ?? sol.E.x / 2);
  out.iso = buildIsometric(sol);
  return { geometry: out, shape };
}
