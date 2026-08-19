// §7 Drawing mode: the sheet, centred, on the dark ground.

import React from "react";
import { scaleLabel } from "../drawing/sheet.js";

export default function DrawingView({ derived }) {
  const { sheet } = derived;
  return (
    <div className="drawing-mode">
      <div className="sheet-chips">
        <span>A3 · 420 × 297</span>
        <span>SCALE {scaleLabel(sheet.scale)}</span>
        <span>ISO {scaleLabel(sheet.isoScale)}</span>
        <span>SECTION AT x = {Math.round(sheet.sectionAt * 10) / 10}</span>
        <button type="button" onClick={() => downloadSvg(sheet.svg)}>Export SVG</button>
      </div>
      <div className="sheet-holder" dangerouslySetInnerHTML={{ __html: sheet.svg }} />
    </div>
  );
}

function downloadSvg(svg) {
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "drawing.svg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
