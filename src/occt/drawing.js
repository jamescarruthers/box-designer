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
import { explodedBox } from "../model/explode.js";

/**
 * Build the orthographic views and the isometric with the kernel. The section
 * stays analytic: it is already exact for axis-aligned boxes, and a boolean
 * against a half-space would only add the bevels in section.
 *
 * `fittingsFor` is indexed by panel rather than handed a panel object: this
 * call crosses a worker boundary, where a closure over the derived state
 * cannot follow. It used to read `opts.fittingsOn`, off an `opts` that was
 * never declared — a ReferenceError on the first panel, every time, with no
 * test on this function to catch it.
 */
export function kernelViews(oc, sol, edges, owners, opts = {}) {
  const { sectionAt, tangentEdges = false, explode = 0,
    fittingsFor = () => [], tubesFor = () => [] } = opts;
  const bevelsFor = (i, p) => panelBevels(i, p, edges, owners);
  const shape = assembly(oc, sol.panels, bevelsFor, fittingsFor, tubesFor);
  const out = {};
  for (const view of ["front", "end", "plan"]) {
    const raw = viewGeometry(oc, shape, view, sol.E, { tangentEdges });
    out[view] = { view, ext: VIEW_EXTENT[view](sol.E), ...mergeViewLines(raw.lines), classes: raw.classes };
  }
  out.section = buildSection(sol, sectionAt ?? sol.E.x / 2);

  // §56 The isometric of the box as it comes apart, from the kernel.
  //
  // §38 said this could not be asked for — "the panels are one solid by then" —
  // and fell back to the analytic isometric whenever the slider was off zero.
  // That was wrong about the shape: the assembly is a *compound* of separate
  // panel solids, never a fusion, so moving each one is a matter of building it
  // from its exploded box. And explode moves a panel along its own normal only,
  // which is the one direction a bore does not take from `at`: the planar
  // coordinates a hole is drilled at are untouched and the thickness axis comes
  // from the box that moved. The bevels are looked up against the panel where
  // it *was*, since a fillet belongs to an edge rather than to a position.
  const apart = explode > 0
    ? assembly(oc, sol.panels.map((p) => ({ ...p, box: explodedBox(p, explode) })),
      (i) => bevelsFor(i, sol.panels[i]), fittingsFor, tubesFor)
    : shape;
  out.iso = isoGeometry(oc, apart, sol.E);
  return { geometry: out, shape };
}
