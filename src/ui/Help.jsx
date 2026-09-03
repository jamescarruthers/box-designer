// §60 The rules, in one place.
//
// The sidebar and the inspector used to carry two hundred and sixty words of
// grey text between their fields, every word of it a rule the controls already
// enforce. The rules are here now, once, for whoever wants to read them; the
// controls say what they will and will not take by being enabled or not.

import React, { useCallback, useRef } from "react";
import { useDismiss } from "./popover.js";

export default function Help({ onClose }) {
  const box = useRef(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDismiss(box, true, close);
  return (
    <div className="help-backdrop">
      <div className="help" role="dialog" aria-label="Help" ref={box}>
        <header>
          <h2>How the box is made</h2>
          <button type="button" className="drop" aria-label="Close help" onClick={onClose}>×</button>
        </header>
        <div className="help-body">
          <h3>Starting point</h3>
          <p>Give the box internal or external sizes, or a volume and a proportion.
            Wall thickness is added to internal sizes to get the outside of the box.
            A proportion of 1 : 1.25 : 1.6 keeps a loudspeaker's axial modes apart.</p>
          <p>Sizes are rounded to the step you choose, on the outside of the box, so the
            cut list always adds up. The cavity moves by up to half a step instead.</p>

          <h3>Prominence</h3>
          <p>At every corner one panel runs past the other. Prominence is the order that
            decides it, over all six faces: a face runs past every face below it and stops
            inside every face above it. Reordering changes every panel size and no internal
            size. It is a joinery choice, not a tuning knob.</p>
          <p>Doublers follow the carcass's order unless given one of their own.</p>

          <h3>Layers</h3>
          <p>Each face carries a carcass panel and may carry cladding outside it, a doubler
            inside it, and lagging inside that. Cladding grows the box; a doubler and lagging
            eat the cavity. Each added layer has its own sheet, thickness and colour.</p>

          <h3>Edges</h3>
          <p>A chamfer or fillet is cut from the outer face after assembly, so blank sizes
            never change. It needs one panel to run the whole edge, so an edge broken by
            another panel stays square. The radius is capped at the thinnest wall it would
            be cut from.</p>
          <p>A mitre needs both panels to meet along the whole edge at the same thickness,
            and a panel takes mitres on opposite sides, not adjacent ones. Choosing one
            mitre can close others off; the edge menus say which.</p>
          <p>Set all edges at once in the sidebar. For one edge, right-click it in the box or
            open the panel it belongs to.</p>

          <h3>Rebates</h3>
          <p>A rebated board is let into the panels beside it: it grows by the depth on each
            side chosen, and a groove is cut in whatever it runs into. The board has to stop
            against a panel to be let into it, so the sides available depend on prominence.
            Linings cannot be rebated.</p>

          <h3>Fittings</h3>
          <p>A driver is a cutout with a bolt circle; a port is a bore with an optional tube.
            Both are cut through every layer on the face and positioned on the outermost.
            Holes can stop at any layer. A driver's displacement is estimated from its shape
            until you give the figure off its datasheet.</p>

          <h3>Cut list and sheets</h3>
          <p>Parts are sorted by layer then area. Sheets are packed first-fit decreasing with
            the kerf allowed for, grouped by material and thickness, rotating parts unless the
            grain is locked. Grain locking binds only sheets that have a grain.</p>

          <h3>Drawing</h3>
          <p>A3, first angle, at a real preferred scale. Section A–A is cut on a vertical plane
            and viewed from the left; move it for a port or an off-centre brace. The
            isometric can be exploded.</p>

          <h3>Keyboard</h3>
          <p>Ctrl+Z undoes, Ctrl+Shift+Z or Ctrl+Y redoes. Escape closes a menu.
            In the box, drag to orbit, shift-drag to pan, wheel to zoom.</p>
        </div>
      </div>
    </div>
  );
}
