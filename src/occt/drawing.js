// §6 The sheet, drawn by the kernel.
//
// The seam is `{ view, ext, lines, arcs }`: whatever produces it, sheet.js
// renders it. So the kernel becomes an alternative producer of the same shape
// and the frame, title block, scale selection, dimensions and hatching — all
// the things §11 notes OCCT does not give you — are untouched.

import { assembly } from "./solids.js";
import { viewGeometry, isoGeometry } from "./hlr.js";
import { mergeViewLines } from "./merge.js";
import { VIEW_EXTENT } from "../drawing/hlr.js";
import { panelBevels } from "../model/bevel.js";
import { buildSection } from "../drawing/section.js";

/**
 * Build the orthographic views and the isometric with the kernel. The section
 * stays analytic: it is already exact for axis-aligned boxes, and a boolean
 * against a half-space would only add the bevels in section.
 */
export function kernelViews(oc, sol, edges, owners, { sectionAt, tangentEdges = false } = {}) {
  const shape = assembly(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners));
  const out = {};
  for (const view of ["front", "end", "plan"]) {
    const raw = viewGeometry(oc, shape, view, sol.E, { tangentEdges });
    out[view] = { view, ext: VIEW_EXTENT[view](sol.E), ...mergeViewLines(raw.lines), classes: raw.classes };
  }
  out.section = buildSection(sol, sectionAt ?? sol.E.x / 2);
  out.iso = isoGeometry(oc, shape, sol.E);
  return { geometry: out, shape };
}
