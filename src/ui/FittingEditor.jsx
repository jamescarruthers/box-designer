// §10 One fitting's controls, and the list of them.
//
// Shared between the sidebar, which lists every fitting on the box, and the
// inspector (§21), which lists the ones on the face you have selected. The same
// fitting has to read the same way in both — a driver whose PCD field is in a
// different place depending on which panel you opened it from is two controls
// wearing one name.

import React from "react";
import { FACES, FACE_LABEL } from "../model/constants.js";
import { newFitting, describeFitting, faceAxes, hasTube, convertAt } from "../model/fittings.js";
import { Num, Segmented, round } from "./fields.jsx";

/** A new fitting, centred on the face it is being put on. */
export function centredFitting(derived, type, face) {
  const panel = derived.fittingPanels?.[face]
    ?? derived.sol.panels.find((p) => p.face === face)
    ?? derived.sol.panels[0];
  const [p, q] = faceAxes(panel.face);
  return newFitting(type, panel.face, {
    a: (panel.box[p][0] + panel.box[p][1]) / 2,
    b: (panel.box[q][0] + panel.box[q][1]) / 2,
  });
}

/**
 * One fitting.
 *
 * `index` is its place in the design's own list, which is what the labels are
 * numbered by — so a fitting keeps the name it has in the sidebar when it is
 * looked at from the inspector, and a test that finds "Fitting 2 pcd" finds the
 * same field in both.
 *
 * `onFace` drops the face picker: inside the inspector the face is the thing
 * you selected, and a control that could move the fitting off the panel you are
 * looking at would empty the panel you are looking at.
 */
export function FittingEditor({ fitting: f, index, edit, remove, derived, onFace = false }) {
  const [p, q] = faceAxes(f.face);
  const ratio = f.units === "ratio";
  const panel = derived.fittingPanels?.[f.face];
  const n = index + 1;
  // §20 Switching units moves the number, not the fitting.
  const setUnits = (units) => edit({ units, at: convertAt(f, panel, units) });
  return (
    <div className="fitting">
      <div className="fitting-head">
        {onFace ? (
          <span className="on-face">{FACE_LABEL[f.face]}</span>
        ) : (
          <select value={f.face} aria-label={`Fitting ${n} face`}
            onChange={(e) => edit({ face: e.target.value })}>
            {FACES.map((x) => <option key={x} value={x}>{FACE_LABEL[x]}</option>)}
          </select>
        )}
        <span className="kind">{f.type === "port" ? "Port" : "Driver"}</span>
        <button type="button" className="drop" aria-label={`Remove fitting ${n}`}
          onClick={remove}>×</button>
      </div>
      <div className="fitting-units">
        <Segmented ariaLabel={`Fitting ${n} units`} value={ratio ? "ratio" : "mm"}
          onChange={setUnits}
          options={[{ id: "mm", name: "mm" }, { id: "ratio", name: "% of panel" }]} />
      </div>
      <div className="fitting-grid">
        <Num label={`At ${p}`} aria={`Fitting ${n} at ${p}`} suffix={ratio ? "%" : "mm"}
          value={round(f.at.a)} onChange={(v) => edit({ at: { ...f.at, a: v } })} />
        <Num label={`At ${q}`} aria={`Fitting ${n} at ${q}`} suffix={ratio ? "%" : "mm"}
          value={round(f.at.b)} onChange={(v) => edit({ at: { ...f.at, b: v } })} />
        {f.type === "driver" ? (
          <>
            <Num label="Cutout ⌀" aria={`Fitting ${n} cutout`} suffix="mm" step={0.5} value={f.cutout} onChange={(v) => edit({ cutout: v })} />
            <Num label="PCD" aria={`Fitting ${n} pcd`} suffix="mm" step={0.5} value={f.pcd} onChange={(v) => edit({ pcd: v })} />
            <Num label="Bolts" aria={`Fitting ${n} bolts`} value={f.bolts} min={2} onChange={(v) => edit({ bolts: Math.max(2, Math.round(v)) })} />
            <Num label="Bolt ⌀" aria={`Fitting ${n} boltHole`} suffix="mm" step={0.5} value={f.boltHole} onChange={(v) => edit({ boltHole: v })} />
          </>
        ) : (
          <>
            {/* The bore is the tube's inside diameter, continuous from the
                outer face of the panel to the end of the tube. */}
            <Num label="Inside ⌀" aria={`Fitting ${n} diameter`} suffix="mm" step={0.5} value={f.diameter} onChange={(v) => edit({ diameter: v })} />
            <Num label="Length" aria={`Fitting ${n} length`} suffix="mm" value={f.length}
              disabled={!hasTube(f)} onChange={(v) => edit({ length: v })} />
            <Num label="Wall" aria={`Fitting ${n} wall`} suffix="mm" step={0.5} value={f.wall}
              disabled={!hasTube(f)} onChange={(v) => edit({ wall: v })} />
          </>
        )}
      </div>
      {f.type === "port" ? (
        <label className="check">
          <input type="checkbox" checked={hasTube(f)} aria-label={`Fitting ${n} tube`}
            onChange={(e) => edit({ tube: e.target.checked })} />
          <span>Fit a tube behind the hole</span>
        </label>
      ) : null}
      <p className="note">{describeFitting(f)}</p>
    </div>
  );
}

/**
 * The fittings of a design, or the subset of them on one face.
 *
 * `face` narrows the list and fixes what a new one is put on. The indices
 * handed to the editor are into the *design's* list either way, so removing the
 * second fitting on the front removes that one and not the second on the box.
 */
export function FittingList({ design, set, derived, face = null }) {
  const list = design.fittings ?? [];
  const put = (next) => set({ ...design, fittings: next });
  const shown = list.map((f, i) => [f, i]).filter(([f]) => !face || f.face === face);
  const add = (type) => put([...list, centredFitting(derived, type, face ?? "front")]);

  return (
    <div className="stack">
      <div className="stack-head">
        <h3>{shown.length ? `${shown.length} fitted` : "None"}</h3>
        <select className="add" value="" aria-label={face ? `Add a fitting to the ${FACE_LABEL[face].toLowerCase()}` : "Add a fitting"}
          onChange={(e) => { if (e.target.value) add(e.target.value); }}>
          <option value="">Add…</option>
          <option value="driver">Driver</option>
          <option value="port">Port</option>
        </select>
      </div>

      {shown.map(([f, i]) => (
        <FittingEditor key={f.id} fitting={f} index={i} derived={derived} onFace={Boolean(face)}
          edit={(patch) => put(list.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
          remove={() => put(list.filter((_, j) => j !== i))} />
      ))}
    </div>
  );
}
