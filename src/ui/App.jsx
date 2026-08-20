import React, { useMemo, useState, useCallback } from "react";
import Controls from "./Controls.jsx";
import Viewport, { RENDER_STYLES, VIEW_PRESETS } from "./Viewport.jsx";
import CutListView from "./CutListView.jsx";
import DrawingView from "./DrawingView.jsx";
import { DEFAULT_DESIGN, derive } from "./design.js";
import { useKernelSolids } from "./useKernelSolids.js";
import { kernelProgress } from "../occt/kernel.js";
import { fmt } from "../cutlist/cutlist.js";

const MODES = [
  { id: "view", name: "3D view" },
  { id: "cuts", name: "Cut list & sheets" },
  { id: "drawing", name: "Drawing" },
];

export default function App() {
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [mode, setMode] = useState("view");
  const [style, setStyle] = useState("shaded-edges");
  const [colourByFace, setColourByFace] = useState(true);
  const [explode, setExplode] = useState(0);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [camera, setCamera] = useState({ preset: "iso", nonce: 0 });
  const [solidEngine, setSolidEngine] = useState("analytic");

  const derived = useMemo(() => {
    try { return { ok: true, ...derive(design) }; }
    catch (e) { return { ok: false, error: e }; }
  }, [design]);

  const onSelect = useCallback((i) => setSelected((cur) => (cur === i ? null : i)), []);
  const kernelSolids = useKernelSolids(derived.ok ? derived : null, derived.ok && solidEngine === "kernel");

  if (!derived.ok) {
    return <div className="app fatal"><p>The box cannot be solved: {String(derived.error?.message ?? derived.error)}</p></div>;
  }

  const errors = derived.messages.filter((m) => m.level === "error");
  const warnings = derived.messages.filter((m) => m.level === "warning");
  const selectedRow = derived.rows.find((r) => r.panelIndex === selected);

  return (
    <div className="app">
      <aside className="side">
        <header className="brand">
          <h1>Sheet Box Designer</h1>
          <input className="title-input" value={design.title} aria-label="Drawing title"
            onChange={(e) => setDesign({ ...design, title: e.target.value.toUpperCase() })} />
        </header>
        <Controls design={design} set={setDesign} derived={derived} colourByFace={colourByFace} />
        <footer className="side-foot">
          <button type="button" onClick={() => setDesign(DEFAULT_DESIGN)}>Reset</button>
        </footer>
      </aside>

      <main className="main">
        <nav className="modes">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={mode === m.id ? "on" : ""}
              onClick={() => setMode(m.id)}>{m.name}</button>
          ))}
          <span className="spacer" />
          <span className="stat">{fmt(derived.sol.E.x)} × {fmt(derived.sol.E.y)} × {fmt(derived.sol.E.z)} mm</span>
          <span className="stat">{derived.totals.parts} parts · {derived.totals.sheets} sheet{derived.totals.sheets === 1 ? "" : "s"}</span>
        </nav>

        <div className="stage">
          {/* The viewport stays mounted and is hidden with CSS, so the camera survives. */}
          <div className={`pane pane-view ${mode === "view" ? "" : "hidden"}`}>
            <Viewport derived={derived} style={style} colourByFace={colourByFace} explode={explode}
              selected={selected} hovered={hovered} onSelect={onSelect} hidden={mode !== "view"} camera={camera}
              solids={solidEngine === "kernel" ? kernelSolids.solids : null} />
            <div className="chips">
              <div className="chip-group">
                {RENDER_STYLES.map((s) => (
                  <button key={s.id} type="button" className={style === s.id ? "on" : ""}
                    onClick={() => setStyle(s.id)}>{s.name}</button>
                ))}
              </div>
              <div className="chip-group">
                <button type="button" className={colourByFace ? "on" : ""} onClick={() => setColourByFace(true)}>By face</button>
                <button type="button" className={colourByFace ? "" : "on"} onClick={() => setColourByFace(false)}>Material</button>
              </div>
              <div className="chip-group">
                {Object.keys(VIEW_PRESETS).map((p) => (
                  <button key={p} type="button" onClick={() => setCamera({ preset: p, nonce: Date.now() })}>{p}</button>
                ))}
              </div>
              <div className="chip-group">
                <button type="button" className={solidEngine === "analytic" ? "on" : ""}
                  onClick={() => setSolidEngine("analytic")}>Analytic</button>
                <button type="button" className={solidEngine === "kernel" ? "on" : ""}
                  onClick={() => setSolidEngine("kernel")}>OpenCASCADE</button>
              </div>
              <div className="chip-group explode">
                <label htmlFor="explode">Explode</label>
                <input id="explode" type="range" min="0" max="120" value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))} />
                <output>{explode}</output>
              </div>
            </div>
            {solidEngine === "kernel" ? (
              <div className="solid-state">{solidNote(kernelSolids)}</div>
            ) : null}
            {selectedRow ? (
              <div className="selection">
                <strong>{selectedRow.id}</strong> {selectedRow.faceLabel} {selectedRow.layerLabel} ·{" "}
                {fmt(selectedRow.length)} × {fmt(selectedRow.width)} × {fmt(selectedRow.thickness)} mm
                {selectedRow.edgeWork !== "—" ? ` · ${selectedRow.edgeWork}` : ""}
              </div>
            ) : null}
          </div>

          {mode === "cuts" ? (
            <div className="pane pane-cuts">
              <CutListView derived={derived} colourByFace={colourByFace}
                selected={selected} hovered={hovered} onSelect={onSelect} onHover={setHovered} />
            </div>
          ) : null}

          {mode === "drawing" ? (
            <div className="pane pane-drawing"><DrawingView derived={derived} design={design} /></div>
          ) : null}
        </div>

        {errors.length || warnings.length ? (
          <div className="messages">
            {errors.map((m, i) => <p key={`e${i}`} className="error">{m.text}</p>)}
            {warnings.map((m, i) => <p key={`w${i}`} className="warning">{m.text}</p>)}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function solidNote(k) {
  if (k.status === "loading") return `${kernelProgress(k.progress)}…`;
  if (k.status === "refreshing") return "remeshing…";
  if (k.status === "failed") return `${k.error?.message ?? "kernel unavailable"} — showing the ring-stack solids`;
  if (k.status === "ready") return `B-Rep, ${k.triangles} triangles, ${k.ms} ms${k.threaded ? ", threaded" : ""}`;
  return "";
}
