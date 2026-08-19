// §7 Control groups: starting point, material, prominence, reinforcement, edge treatment.

import React from "react";
import { FACES, FACE_LABEL, MATERIALS, PROMINENCE_PRESETS, EDGES, edgeAxis } from "../model/constants.js";
import { panelColour } from "../three/palette.js";
import { setIn } from "./design.js";
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

function Num({ label, value, onChange, step = 1, min = 0, suffix }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input type="number" aria-label={label} value={value} step={step} min={min}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  );
}

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
  const swatch = (face, layer) => colourByFace
    ? <i className="swatch" style={{ background: panelColour({ face, layer }) }} /> : null;

  return (
    <div className="controls">
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
          <select value={design.material} onChange={(e) => set({ ...design, material: e.target.value, stockIndex: 0 })}>
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
          onChange={(v) => set({ ...design, thickness: v, thicknessBy: Object.fromEntries(FACES.map((f) => [f, v])) })} />
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
          <input type="checkbox" checked={design.grainLocked} disabled={!derived.material.grained}
            onChange={(e) => set({ ...design, grainLocked: e.target.checked })} />
          <span>Lock grain along length{derived.material.grained ? "" : " (no grain)"}</span>
        </label>
      </Group>

      <Group title="Prominence"
        note="A rank over all six faces. Reordering changes every panel size and no internal dimension — it is a joinery choice, not a tuning knob.">
        <label className="field">
          <span>Preset</span>
          <select value={design.preset}
            onChange={(e) => {
              const p = PROMINENCE_PRESETS.find((x) => x.id === e.target.value);
              set({ ...design, preset: p.id, order: p.order });
            }}>
            {PROMINENCE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {design.preset === "custom" ? <option value="custom">Custom</option> : null}
          </select>
        </label>
        <ol className="prominence">
          {design.order.map((f, i) => (
            <li key={f}>
              <span className="rank">{i}</span>
              {swatch(f, "shell")}
              <span className="name">{FACE_LABEL[f]}</span>
              <span className="moves">
                <button type="button" aria-label={`Raise ${f}`} disabled={i === 0} onClick={() => move(design, set, i, -1)}>▲</button>
                <button type="button" aria-label={`Lower ${f}`} disabled={i === 5} onClick={() => move(design, set, i, 1)}>▼</button>
              </span>
            </li>
          ))}
        </ol>
      </Group>

      <Group title="Reinforcement" note="Cladding lies outside the carcass and grows the box. A doubler lies inside and eats the cavity.">
        <table className="reinf">
          <thead><tr><th>Face</th><th>Clad</th><th>Doubler</th></tr></thead>
          <tbody>
            {FACES.map((f) => (
              <tr key={f}>
                <th scope="row">{swatch(f, "shell")}{FACE_LABEL[f]}</th>
                <td><input type="number" min="0" step="0.5" value={design.cladding[f]}
                  onChange={(e) => set(setIn(design, ["cladding", f], Number(e.target.value) || 0))} /></td>
                <td><input type="number" min="0" step="0.5" value={design.doubler[f]}
                  onChange={(e) => set(setIn(design, ["doubler", f], Number(e.target.value) || 0))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Group>

      <Group title="Edge treatment" note="Cut from the outer face after assembly. Blank sizes are unchanged.">
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
              return (
                <div className="edge-row" key={k}>
                  <span className="edge-key">{k.replace("|", " / ")}<em>runs {edgeAxis(k)}</em></span>
                  <select value={cur.type}
                    onChange={(e) => set(setIn(design, ["edge", "by", k], { ...cur, type: e.target.value }))}>
                    <option value="none">Square</option>
                    <option value="chamfer">Chamfer</option>
                    <option value="fillet">Fillet</option>
                  </select>
                  <input type="number" min="0" step="0.5" value={cur.radius}
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

function move(design, set, i, d) {
  const order = [...design.order];
  [order[i], order[i + d]] = [order[i + d], order[i]];
  const match = PROMINENCE_PRESETS.find((p) => p.order.join() === order.join());
  set({ ...design, order, preset: match ? match.id : "custom" });
}
