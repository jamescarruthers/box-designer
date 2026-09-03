// §60 How the box is looked at, in one place.
//
// The chip bar over the 3D view had eight groups: four render styles, two
// colourings, the drivers, four camera presets, two projections, two engines,
// four edge tools and the explode. Only the presets and the explode are used
// more than once a session. The rest are set and left — so they are folded
// into one menu, and the bar is three things wide.
//
// One component for both views. The rendered view has no styles or colourings
// (it draws the sheet as it is), so a section is shown only when the view
// hands over a way to change it.

import React, { useCallback, useRef, useState } from "react";
import { useDismiss } from "./popover.js";
import { RENDER_STYLES } from "./Viewport.jsx";

function Row({ label, children }) {
  return (
    <div className="popover-row">
      <span className="popover-label">{label}</span>
      <div className="segmented">{children}</div>
    </div>
  );
}

const Choice = ({ on, onClick, children }) => (
  <button type="button" className={on ? "on" : ""} aria-pressed={on} onClick={onClick}>{children}</button>
);

export default function ViewMenu({
  style, onStyle, colourByFace, onColourByFace, parallel, onParallel, drivers, onDrivers,
}) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);

  return (
    <div className="chip-group menu-host" ref={box}>
      <button type="button" className={open ? "on" : ""} aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen(!open)}>View ▾</button>
      {open ? (
        <div className="popover" role="group" aria-label="View">
          {onStyle ? (
            <Row label="Style">
              {RENDER_STYLES.map((s) => (
                <Choice key={s.id} on={style === s.id} onClick={() => onStyle(s.id)}>{s.name}</Choice>
              ))}
            </Row>
          ) : null}
          {onColourByFace ? (
            <Row label="Colour">
              <Choice on={!colourByFace} onClick={() => onColourByFace(false)}>By material</Choice>
              <Choice on={colourByFace} onClick={() => onColourByFace(true)}>By face</Choice>
            </Row>
          ) : null}
          {onParallel ? (
            <Row label="Projection">
              <Choice on={!parallel} onClick={() => onParallel(false)}>Perspective</Choice>
              <Choice on={parallel} onClick={() => onParallel(true)}>Parallel</Choice>
            </Row>
          ) : null}
          {onDrivers ? (
            <Row label="Drivers">
              <Choice on={drivers} onClick={() => onDrivers(true)}>Shown</Choice>
              <Choice on={!drivers} onClick={() => onDrivers(false)}>Hidden</Choice>
            </Row>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
