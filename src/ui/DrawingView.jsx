// §7 Drawing mode: the sheet, centred, on the dark ground.
//
// §60 And what the sheet shows, set on the sheet. The section, the insulation,
// the exploded isometric and where the section plane cuts were in the sidebar,
// in every mode, where they only ever changed this one.

import React, { useState } from "react";
import { scaleLabel } from "../drawing/sheet.js";
import { useKernelSheet } from "./useKernelSheet.js";
import { kernelProgress } from "../occt/kernel.js";
import { download } from "./file.js";
import { setIn } from "./design.js";
import { Num } from "./fields.jsx";

export default function DrawingView({ derived, design, set, debug = false }) {
  // §56 OpenCASCADE from the start, as §23 did for the 3D view and for the same
  // reason: the kernel draws the box that is being made. It cuts the holes, it
  // rounds the edges, it removes the hidden lines, and — now that it is handed
  // the panels where the explode put them — it draws the isometric of a box
  // coming apart. The analytic sheet is what is on screen while the kernel
  // loads and what is left if it will not.
  const [engine, setEngine] = useState("kernel");
  const [attempt, setAttempt] = useState(0);
  const kernel = useKernelSheet(derived, design, engine === "kernel", attempt);

  // Fall back to the analytic sheet while the kernel loads, or if it fails.
  const sheet = engine === "kernel" && kernel.sheet ? kernel.sheet : derived.sheet;
  const showing = engine === "kernel" && kernel.sheet ? "kernel" : "analytic";
  const note = engineNote(engine, showing, kernel, debug);
  const { drawing } = derived;

  return (
    <div className="drawing-mode">
      <div className="sheet-chips">
        <span>A3 · 420 × 297</span>
        <span>SCALE {scaleLabel(sheet.scale)}</span>
        <span>ISO {scaleLabel(sheet.isoScale)}</span>
        {debug ? (
          <span className="engine">
            <button type="button" className={engine === "analytic" ? "on" : ""}
              onClick={() => setEngine("analytic")}>Analytic</button>
            <button type="button" className={engine === "kernel" ? "on" : ""}
              onClick={() => setEngine("kernel")}>OpenCASCADE</button>
          </span>
        ) : null}
        {note ? (
          <span className="engine-state">
            {note}
            {engine === "kernel" && kernel.status === "failed" ? (
              <button type="button" className="linkish"
                onClick={() => setAttempt((n) => n + 1)}>Try again</button>
            ) : null}
          </span>
        ) : null}
        <button type="button" onClick={() => downloadSvg(sheet.svg)}>Export SVG</button>
      </div>
      {set ? (
        <div className="sheet-controls">
          {/* §32 What goes on the sheet. §38 The isometric keeps its column
              either way; what dropping the section frees is the height its own
              row was taking, which every view on the sheet shares. */}
          <label className="check">
            <input type="checkbox" checked={drawing.section}
              onChange={(e) => set(setIn(design, ["drawing", "section"], e.target.checked))} />
            <span>Section A–A</span>
          </label>
          <Num label="Section at x" suffix="mm" step={1} value={Math.round(derived.sectionAt * 10) / 10}
            disabled={!drawing.section}
            onChange={(v) => set({ ...design, sectionAt: v })} />
          <button type="button" className="linkish" disabled={!drawing.section}
            onClick={() => set({ ...design, sectionAt: null })}>
            Centre
          </button>
          <label className="check">
            <input type="checkbox" checked={drawing.insulation}
              onChange={(e) => set(setIn(design, ["drawing", "insulation"], e.target.checked))} />
            <span>Acoustic insulation</span>
          </label>
          {/* §38 The isometric comes apart. It is the one view that shows the
              whole box, so it is the one worth pulling open. */}
          <div className="chip-group explode">
            <label htmlFor="iso-explode">Explode isometric</label>
            <input id="iso-explode" type="range" min="0" max="120" step="5"
              value={drawing.explode}
              onChange={(e) => set(setIn(design, ["drawing", "explode"], Number(e.target.value)))} />
            <output>{drawing.explode}</output>
          </div>
        </div>
      ) : null}
      <div className="sheet-holder" dangerouslySetInnerHTML={{ __html: sheet.svg }} />
    </div>
  );
}

/**
 * §60 What to say about the kernel: that it is still drawing, or that it
 * failed and the analytic sheet is up instead. Ready is nothing to say, and
 * which engine it was is a developer's question, answered with `?debug`.
 */
export function engineNote(engine, showing, kernel, debug = false) {
  if (engine !== "kernel") return debug ? "exact rectangle arithmetic" : null;
  if (kernel.status === "loading") return `${kernelProgress(kernel.progress)}…`;
  if (kernel.status === "refreshing") return debug ? "redrawing…" : null;
  if (kernel.status === "failed") {
    return `${kernel.error?.message ?? "The precise drawing would not build"} — showing the analytic sheet`;
  }
  // No thread claim here: HLRBRep has no parallel mode, so the sheet is serial
  // whether or not the page is cross-origin isolated.
  if (showing === "kernel" && debug) return `B-Rep, ${kernel.ms} ms`;
  return null;
}

const downloadSvg = (svg) =>
  download(`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`, "drawing.svg", "image/svg+xml");
