// §7 Drawing mode: the sheet, centred, on the dark ground.

import React, { useState } from "react";
import { scaleLabel } from "../drawing/sheet.js";
import { useKernelSheet } from "./useKernelSheet.js";

export default function DrawingView({ derived, design }) {
  const [engine, setEngine] = useState("analytic");
  const kernel = useKernelSheet(derived, design, engine === "kernel");

  // Fall back to the analytic sheet while the kernel loads, or if it fails.
  const sheet = engine === "kernel" && kernel.sheet ? kernel.sheet : derived.sheet;
  const showing = engine === "kernel" && kernel.sheet ? "kernel" : "analytic";

  return (
    <div className="drawing-mode">
      <div className="sheet-chips">
        <span>A3 · 420 × 297</span>
        <span>SCALE {scaleLabel(sheet.scale)}</span>
        <span>ISO {scaleLabel(sheet.isoScale)}</span>
        <span>SECTION AT x = {Math.round(sheet.sectionAt * 10) / 10}</span>
        <span className="engine">
          <button type="button" className={engine === "analytic" ? "on" : ""}
            onClick={() => setEngine("analytic")}>Analytic</button>
          <button type="button" className={engine === "kernel" ? "on" : ""}
            onClick={() => setEngine("kernel")}>OpenCASCADE</button>
        </span>
        <span className="engine-state">{engineNote(engine, showing, kernel)}</span>
        <button type="button" onClick={() => downloadSvg(sheet.svg)}>Export SVG</button>
      </div>
      <div className="sheet-holder" dangerouslySetInnerHTML={{ __html: sheet.svg }} />
    </div>
  );
}

function engineNote(engine, showing, kernel) {
  if (engine !== "kernel") return "exact rectangle arithmetic";
  if (kernel.status === "loading") return "fetching the kernel, 3.5 MB…";
  if (kernel.status === "refreshing") return "redrawing…";
  if (kernel.status === "failed") return "kernel unavailable — showing the analytic sheet";
  // No thread claim here: HLRBRep has no parallel mode, so the sheet is serial
  // whether or not the page is cross-origin isolated.
  if (showing === "kernel") return `B-Rep, ${kernel.ms} ms`;
  return "";
}

function downloadSvg(svg) {
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "drawing.svg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
