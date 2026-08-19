// §7 Control groups: starting point, material, prominence, reinforcement, edge treatment.

import React, { useState } from "react";
import { FACES, FACE_LABEL, MATERIALS, PROMINENCE_PRESETS, EDGES, edgeAxis, materialById } from "../model/constants.js";
import { panelColour } from "../three/palette.js";
import { setIn, freeFaces, addPanel, removePanel, editPanel, setProjectMaterial, setProjectThickness } from "./design.js";
import { newFitting, describeFitting, faceAxes, FITTING_DEFAULTS } from "../model/fittings.js";
import { fmt } from "../cutlist/cutlist.js";

function Group({ title, note, children }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      {note ? <p className="note">{note}</p> : null}
      <div className="group-body">{children}</div>
    </section>
  );
}

function Num({ label, value, onChange, step = 1, min = 0, suffix, list, aria }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input type="number" aria-label={aria ?? label} value={value} step={step} min={min} list={list}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  );
}

/** The face swatch, shown only while face colouring is on. */
const FaceSwatch = ({ face, layer, on }) => on
  ? <i className="swatch" style={{ background: panelColour({ face, layer }) }} /> : null;

function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.id} type="button" className={o.id === value ? "on" : ""}
          onClick={() => onChange(o.id)}>{o.name}</button>
      ))}
    </div>
  );
}

export default function Controls({ design, set, derived, colourByFace }) {
  const s = design.start;
  const cuttable = Object.values(derived.fullLength).filter(Boolean).length;
  return (
    <div className="controls">
      <StockThicknesses />
      <Group title="Starting point">
        <Segmented ariaLabel="Basis" value={s.basis} onChange={(v) => set(setIn(design, ["start", "basis"], v))}
          options={[{ id: "internal", name: "Internal" }, { id: "external", name: "External" }]} />
        <Segmented ariaLabel="Mode" value={s.mode} onChange={(v) => set(setIn(design, ["start", "mode"], v))}
          options={[{ id: "dimensions", name: "Dimensions" }, { id: "volume", name: "Volume" }]} />
        {s.mode === "dimensions" ? (
          <>
            <Num label="Width" suffix="mm" value={s.size.x} onChange={(v) => set(setIn(design, ["start", "size", "x"], v))} />
            <Num label="Depth" suffix="mm" value={s.size.y} onChange={(v) => set(setIn(design, ["start", "size", "y"], v))} />
            <Num label="Height" suffix="mm" value={s.size.z} onChange={(v) => set(setIn(design, ["start", "size", "z"], v))} />
          </>
        ) : (
          <>
            <Num label="Volume" suffix="l" step={0.5} value={s.litres} onChange={(v) => set(setIn(design, ["start", "litres"], v))} />
            <div className="row-3">
              <Num label="W" value={s.ratio.x} step={0.05} onChange={(v) => set(setIn(design, ["start", "ratio", "x"], v))} />
              <Num label="D" value={s.ratio.y} step={0.05} onChange={(v) => set(setIn(design, ["start", "ratio", "y"], v))} />
              <Num label="H" value={s.ratio.z} step={0.05} onChange={(v) => set(setIn(design, ["start", "ratio", "z"], v))} />
            </div>
            <p className="note">Proportion. 1 : 1.25 : 1.6 keeps the axial modes apart.</p>
          </>
        )}
        <dl className="readout">
          <div><dt>Envelope</dt><dd>{fmt(derived.sol.E.x)} × {fmt(derived.sol.E.y)} × {fmt(derived.sol.E.z)}</dd></div>
          <div><dt>Internal</dt><dd>{fmt(derived.sol.internal.x)} × {fmt(derived.sol.internal.y)} × {fmt(derived.sol.internal.z)}</dd></div>
          <div><dt>Cavity</dt><dd>{(derived.sol.internal.x * derived.sol.internal.y * derived.sol.internal.z / 1e6).toFixed(3)} l</dd></div>
        </dl>
      </Group>

      <Group title="Material">
        <label className="field">
          <span>Sheet</span>
          <select value={design.material} onChange={(e) => set(setProjectMaterial(design, e.target.value))}>
            {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Stock</span>
          <select value={design.stockIndex} onChange={(e) => set({ ...design, stockIndex: Number(e.target.value) })}>
            {derived.material.stock.map((st, i) => <option key={i} value={i}>{st[0]} × {st[1]}</option>)}
          </select>
        </label>
        <Num label="Thickness" suffix="mm" step={0.5} value={design.thickness}
          list={`th-${derived.material.id}`}
          onChange={(v) => set(setProjectThickness(design, v))} />
        <label className="check">
          <input type="checkbox" checked={design.perFaceThickness}
            onChange={(e) => set({ ...design, perFaceThickness: e.target.checked })} />
          <span>Thickness per face</span>
        </label>
        {design.perFaceThickness ? (
          <div className="face-grid">
            {FACES.map((f) => (
              <Num key={f} label={FACE_LABEL[f]} suffix="mm" step={0.5} value={design.thicknessBy[f]}
                onChange={(v) => set(setIn(design, ["thicknessBy", f], v))} />
            ))}
          </div>
        ) : null}
        <Num label="Kerf" suffix="mm" step={0.1} value={design.kerf} onChange={(v) => set({ ...design, kerf: v })} />
        <label className="check">
          <input type="checkbox" checked={design.grainLocked}
            onChange={(e) => set({ ...design, grainLocked: e.target.checked })} />
          <span>Lock grain along length, where the sheet has one</span>
        </label>
      </Group>

      <Group title="Prominence"
        note="A rank over all six faces. Reordering changes every panel size and no internal dimension — it is a joinery choice, not a tuning knob.">
        <Prominence design={design} set={set} colourByFace={colourByFace} />
      </Group>

      <Group title="Reinforcement" note="Cladding lies outside the carcass and grows the box. A doubler lies inside and eats the cavity. Each panel starts as the project sheet and can then be changed.">
        <LayerStack design={design} set={set} layer="cladding" title="Cladding" colourByFace={colourByFace} />
        <LayerStack design={design} set={set} layer="doubler" title="Doublers" colourByFace={colourByFace} />
      </Group>

      <Group title="Fittings" note="Drivers and ports are cut into the outermost panel of their face. Position is measured from the panel's own low corner, so it reads straight off the face-on view.">
        <Fittings design={design} set={set} derived={derived} />
      </Group>

      <Group title="Edge treatment" note="Cut from the outer face after assembly. Blank sizes are unchanged.">
        <p className="note">{cuttable} of 12 edges run the full length of one panel. The rest stay square: a bevel would stop against the side of the next panel.</p>
        <Segmented ariaLabel="Treatment" value={design.edge.type}
          onChange={(v) => set(setIn(design, ["edge", "type"], v))}
          options={[{ id: "none", name: "Square" }, { id: "chamfer", name: "Chamfer" }, { id: "fillet", name: "Fillet" }]} />
        <Num label="Radius" suffix="mm" step={0.5} value={design.edge.radius}
          onChange={(v) => set(setIn(design, ["edge", "radius"], v))} />
        <label className="check">
          <input type="checkbox" checked={design.edge.perEdge}
            onChange={(e) => set(setIn(design, ["edge", "perEdge"], e.target.checked))} />
          <span>Per edge</span>
        </label>
        {design.edge.perEdge ? (
          <div className="edge-grid">
            {EDGES.map((k) => {
              const cur = design.edge.by[k] ?? { type: "none", radius: design.edge.radius };
              const ok = derived.fullLength[k];
              return (
                <div className={ok ? "edge-row" : "edge-row blocked"} key={k}>
                  <span className="edge-key">{k.replace("|", " / ")}
                    <em>{ok ? `runs ${edgeAxis(k)}` : "broken by other panels"}</em></span>
                  <select value={cur.type} disabled={!ok} aria-label={`${k} treatment`}
                    onChange={(e) => set(setIn(design, ["edge", "by", k], { ...cur, type: e.target.value }))}>
                    <option value="none">Square</option>
                    <option value="chamfer">Chamfer</option>
                    <option value="fillet">Fillet</option>
                  </select>
                  <input type="number" min="0" step="0.5" value={cur.radius} disabled={!ok}
                    aria-label={`${k} radius`}
                    onChange={(e) => set(setIn(design, ["edge", "by", k], { ...cur, radius: Number(e.target.value) || 0 }))} />
                </div>
              );
            })}
          </div>
        ) : null}
      </Group>

      <Group title="Drawing" note="Section A–A is cut on a vertical plane and viewed from the left. Move it for a port or an off-centre brace.">
        <Num label="Section at x" suffix="mm" step={1} value={Math.round(derived.sectionAt * 10) / 10}
          onChange={(v) => set({ ...design, sectionAt: v })} />
        <button type="button" className="linkish" onClick={() => set({ ...design, sectionAt: null })}>
          Centre the section plane
        </button>
      </Group>
    </div>
  );
}

/**
 * A preset covers most boxes, so the six-face order stays folded away until it
 * is wanted. The summary line always shows the order in force, so folding it
 * back up never hides a hand-made one.
 */
function Prominence({ design, set, colourByFace }) {
  const [open, setOpen] = useState(design.preset === "custom");
  return (
    <>
      <label className="field">
        <span>Preset</span>
        <select value={design.preset}
          onChange={(e) => {
            const p = PROMINENCE_PRESETS.find((x) => x.id === e.target.value);
            if (p) set({ ...design, preset: p.id, order: p.order });
          }}>
          {PROMINENCE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          {design.preset === "custom" ? <option value="custom">Custom</option> : null}
        </select>
      </label>

      {open ? (
        <ol className="prominence">
          {design.order.map((f, i) => (
            <li key={f}>
              <span className="rank">{i}</span>
              <FaceSwatch face={f} layer="shell" on={colourByFace} />
              <span className="name">{FACE_LABEL[f]}</span>
              <span className="moves">
                <button type="button" aria-label={`Raise ${FACE_LABEL[f]}`} disabled={i === 0}
                  onClick={() => move(design, set, i, -1)}>▲</button>
                <button type="button" aria-label={`Lower ${FACE_LABEL[f]}`} disabled={i === 5}
                  onClick={() => move(design, set, i, 1)}>▼</button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="rank-summary" aria-label="Prominence order, most prominent first">
          {design.order.map((f) => (
            <li key={f}>
              <FaceSwatch face={f} layer="shell" on={colourByFace} />
              {FACE_LABEL[f]}
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="linkish" onClick={() => setOpen(!open)}>
        {open ? "Hide the order" : "Override the order…"}
      </button>
    </>
  );
}

/** A list of added panels for one layer, plus a side picker to add another. */
function LayerStack({ design, set, layer, title, colourByFace }) {
  const entries = Object.entries(design[layer] ?? {});
  const free = freeFaces(design, layer);
  return (
    <div className="stack">
      <div className="stack-head">
        <h3>{title}</h3>
        <select className="add" value="" disabled={!free.length}
          aria-label={`Add ${title.toLowerCase()}`}
          onChange={(e) => { if (e.target.value) set(addPanel(design, layer, e.target.value)); }}>
          <option value="">{free.length ? "Add a side…" : "All sides used"}</option>
          {free.map((f) => <option key={f} value={f}>{FACE_LABEL[f]}</option>)}
        </select>
      </div>
      {entries.length === 0 ? (
        <p className="empty">None.</p>
      ) : (
        <ul className="stack-list">
          {entries.map(([face, entry]) => {
            const m = materialById(entry.material);
            return (
              <li key={face}>
                <span className="stack-face">
                  <FaceSwatch face={face} layer={layer} on={colourByFace} />
                  {FACE_LABEL[face]}
                </span>
                <input type="number" min="0" step="0.5" value={entry.thickness}
                  aria-label={`${title} ${FACE_LABEL[face]} thickness`}
                  list={`th-${m.id}`}
                  onChange={(e) => set(editPanel(design, layer, face, { thickness: Number(e.target.value) || 0 }))} />
                <select value={entry.material}
                  aria-label={`${title} ${FACE_LABEL[face]} material`}
                  onChange={(e) => set(editPanel(design, layer, face, { material: e.target.value }))}>
                  {MATERIALS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <button type="button" className="drop" aria-label={`Remove ${title} ${FACE_LABEL[face]}`}
                  onClick={() => set(removePanel(design, layer, face))}>×</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** §10 Drivers and ports: a hole with a bolt circle, and a hole with a tube. */
function Fittings({ design, set, derived }) {
  const list = design.fittings ?? [];
  const put = (next) => set({ ...design, fittings: next });
  const edit = (i, patch) => put(list.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const add = (type) => {
    const face = "front";
    const panel = derived.sol.panels.find((p) => p.face === face) ?? derived.sol.panels[0];
    const [p, q] = faceAxes(panel.face);
    const at = {
      a: (panel.box[p][0] + panel.box[p][1]) / 2,
      b: (panel.box[q][0] + panel.box[q][1]) / 2,
    };
    put([...list, newFitting(type, panel.face, at)]);
  };

  return (
    <div className="stack">
      <div className="stack-head">
        <h3>{list.length ? `${list.length} fitted` : "None"}</h3>
        <select className="add" value="" aria-label="Add a fitting"
          onChange={(e) => { if (e.target.value) add(e.target.value); }}>
          <option value="">Add…</option>
          <option value="driver">Driver</option>
          <option value="port">Port</option>
        </select>
      </div>

      {list.map((f, i) => {
        const [p, q] = faceAxes(f.face);
        return (
          <div className="fitting" key={f.id}>
            <div className="fitting-head">
              <select value={f.face} aria-label={`Fitting ${i + 1} face`}
                onChange={(e) => edit(i, { face: e.target.value })}>
                {FACES.map((x) => <option key={x} value={x}>{FACE_LABEL[x]}</option>)}
              </select>
              <span className="kind">{f.type === "port" ? "Port" : "Driver"}</span>
              <button type="button" className="drop" aria-label={`Remove fitting ${i + 1}`}
                onClick={() => put(list.filter((_, j) => j !== i))}>×</button>
            </div>
            <div className="fitting-grid">
              <Num label={`At ${p}`} aria={`Fitting ${i + 1} at ${p}`} suffix="mm" value={round(f.at.a)}
                onChange={(v) => edit(i, { at: { ...f.at, a: v } })} />
              <Num label={`At ${q}`} aria={`Fitting ${i + 1} at ${q}`} suffix="mm" value={round(f.at.b)}
                onChange={(v) => edit(i, { at: { ...f.at, b: v } })} />
              {f.type === "driver" ? (
                <>
                  <Num label="Cutout ⌀" aria={`Fitting ${i + 1} cutout`} suffix="mm" step={0.5} value={f.cutout} onChange={(v) => edit(i, { cutout: v })} />
                  <Num label="PCD" aria={`Fitting ${i + 1} pcd`} suffix="mm" step={0.5} value={f.pcd} onChange={(v) => edit(i, { pcd: v })} />
                  <Num label="Bolts" aria={`Fitting ${i + 1} bolts`} value={f.bolts} min={2} onChange={(v) => edit(i, { bolts: Math.max(2, Math.round(v)) })} />
                  <Num label="Bolt ⌀" aria={`Fitting ${i + 1} boltHole`} suffix="mm" step={0.5} value={f.boltHole} onChange={(v) => edit(i, { boltHole: v })} />
                </>
              ) : (
                <>
                  <Num label="Bore ⌀" aria={`Fitting ${i + 1} diameter`} suffix="mm" step={0.5} value={f.diameter} onChange={(v) => edit(i, { diameter: v })} />
                  <Num label="Length" aria={`Fitting ${i + 1} length`} suffix="mm" value={f.length} onChange={(v) => edit(i, { length: v })} />
                  <Num label="Wall" aria={`Fitting ${i + 1} wall`} suffix="mm" step={0.5} value={f.wall} onChange={(v) => edit(i, { wall: v })} />
                </>
              )}
            </div>
            <p className="note">{describeFitting(f)}</p>
          </div>
        );
      })}
    </div>
  );
}

const round = (v) => Math.round(v * 10) / 10;

/** The thicknesses each material is sold in, offered on every thickness input. */
function StockThicknesses() {
  return MATERIALS.map((m) => (
    <datalist id={`th-${m.id}`} key={m.id}>
      {m.thicknesses.map((t) => <option key={t} value={t} />)}
    </datalist>
  ));
}

function move(design, set, i, d) {
  const order = [...design.order];
  [order[i], order[i + d]] = [order[i + d], order[i]];
  const match = PROMINENCE_PRESETS.find((p) => p.order.join() === order.join());
  set({ ...design, order, preset: match ? match.id : "custom" });
}
