// §7 Control groups: starting point, material, prominence, panels, edges.
//
// §47 The sidebar is about the box and the inspector is about one board, and
// nothing is in both. What was here a face at a time — a panel's thickness, its
// colour, the cladding or doubler or lagging on it, its rebate, its fittings —
// is in the inspector now, where the panel it belongs to is the thing on the
// screen. What is left is a summary: what the box carries and where, with every
// entry a way into the panel that owns it.
//
// §60 And only what is true of the box in every mode. What the drawing shows
// is set on the drawing; how the sheets are cut is set on the cut list. The
// rules that used to be paragraphs between the fields are in Help, once.

import React, { useState } from "react";
import { FACES, FACE_LABEL, LAYER_LABEL, MATERIALS, PROMINENCE_PRESETS, materialById } from "../model/constants.js";
import { ROUND_STEPS } from "../model/solver.js";
import { setIn, setProjectMaterial, setProjectThickness, setEdgeTreatment, treatedEdges,
  layerOrder, layerPreset, ownOrder, setLayerOrder, setOwnProminence } from "./design.js";
import { largestBevel } from "../model/bevel.js";
import { readRebateKey, rebateLabel } from "../model/rebate.js";
import { Group, Num, Colour, Segmented, FaceSwatch, StockThicknesses } from "./fields.jsx";
import { fmt } from "../cutlist/cutlist.js";

export default function Controls({ design, set, derived, colourByFace, onInspect }) {
  const s = design.start;
  return (
    <div className="controls">
      <StockThicknesses />
      <Group title="Size">
        {/* §60 Labelled: "Internal" on its own does not say internal to what. */}
        <div className="field">
          <span>Sizes are</span>
          <Segmented ariaLabel="Basis" value={s.basis} onChange={(v) => set(setIn(design, ["start", "basis"], v))}
            options={[{ id: "internal", name: "Internal" }, { id: "external", name: "External" }]} />
        </div>
        <div className="field">
          <span>Given as</span>
          <Segmented ariaLabel="Mode" value={s.mode} onChange={(v) => set(setIn(design, ["start", "mode"], v))}
            options={[{ id: "dimensions", name: "Dimensions" }, { id: "volume", name: "Volume" }]} />
        </div>
        {s.mode === "dimensions" ? (
          <>
            <Num label="Width" suffix="mm" value={s.size.x} onChange={(v) => set(setIn(design, ["start", "size", "x"], v))} />
            <Num label="Depth" suffix="mm" value={s.size.y} onChange={(v) => set(setIn(design, ["start", "size", "y"], v))} />
            <Num label="Height" suffix="mm" value={s.size.z} onChange={(v) => set(setIn(design, ["start", "size", "z"], v))} />
          </>
        ) : (
          <>
            <Num label="Volume" suffix="l" step={0.5} value={s.litres} onChange={(v) => set(setIn(design, ["start", "litres"], v))} />
            <div className="field">
              <span>Proportion</span>
              <div className="row-3">
                <Num label="W" value={s.ratio.x} step={0.05} onChange={(v) => set(setIn(design, ["start", "ratio", "x"], v))} />
                <Num label="D" value={s.ratio.y} step={0.05} onChange={(v) => set(setIn(design, ["start", "ratio", "y"], v))} />
                <Num label="H" value={s.ratio.z} step={0.05} onChange={(v) => set(setIn(design, ["start", "ratio", "z"], v))} />
              </div>
            </div>
          </>
        )}
        {/* §16 One rounding, on the envelope, before anything is measured from
            it — so the panels still tile it exactly and the cut list still adds
            up. What moves instead is the cavity, by half a step at most. */}
        <label className="field">
          <span>Round to</span>
          <select value={design.round} aria-label="Round sizes to"
            onChange={(e) => set({ ...design, round: Number(e.target.value) })}>
            {ROUND_STEPS.map((r) => <option key={r} value={r}>{fmt(r)} mm</option>)}
          </select>
        </label>
        <dl className="readout">
          <div><dt>Envelope</dt><dd>{fmt(derived.sol.E.x)} × {fmt(derived.sol.E.y)} × {fmt(derived.sol.E.z)}</dd></div>
          <div><dt>Internal</dt><dd>{fmt(derived.sol.internal.x)} × {fmt(derived.sol.internal.y)} × {fmt(derived.sol.internal.z)}</dd></div>
          <div><dt>Cavity</dt><dd>{(derived.sol.cavityVolume / 1e6).toFixed(3)} l</dd></div>
          {/* §27 What is left once the drivers and port tubes are standing in
              it. Shown only when something is displacing, so a box with no
              fittings does not carry two identical numbers. */}
          {derived.sol.displaced > 0 ? (
            <div>
              <dt>Net</dt>
              {/* §28 "At least", where any driver's displacement is our own
                  arithmetic rather than a figure off its datasheet. The basket
                  is drawn solid, so the displacement reads high and the air
                  left over reads low — the true figure is above this one,
                  not around it. */}
              <dd title={derived.sol.displacedEstimated
                ? `less ${(derived.sol.displaced / 1e6).toFixed(3)} l displaced, estimated from the shape — give each driver the displacement off its datasheet for the real figure`
                : `less ${(derived.sol.displaced / 1e6).toFixed(3)} l displaced`}>
                {derived.sol.displacedEstimated ? "≥ " : ""}{(derived.sol.netVolume / 1e6).toFixed(3)} l
              </dd>
            </div>
          ) : null}
        </dl>
      </Group>

      <Group title="Material">
        <label className="field">
          <span>Sheet</span>
          <select value={design.material} onChange={(e) => set(setProjectMaterial(design, e.target.value))}>
            {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <Num label="Thickness" suffix="mm" step={0.5} value={design.thickness}
          list={`th-${derived.material.id}`}
          onChange={(v) => set(setProjectThickness(design, v))} />
        {/* §47 One thickness and one colour for the carcass. A face that wants
            its own is given it in that panel's inspector, which switches the
            override on as it writes — so what is left here is the way back to
            a box cut from one sheet. */}
        <Departures design={design} derived={derived} onInspect={onInspect}
          on="perFaceThickness" by="thicknessBy" uniform={design.thickness}
          label="thickness" undo="Back to one thickness"
          set={set} format={(v) => `${fmt(v)} mm`} />
        <Colour label="Colour" aria="Sheet" material={design.material} value={design.colour}
          onChange={(hex) => set({ ...design, colour: hex })} />
        <Departures design={design} derived={derived} onInspect={onInspect}
          on="perPanelColour" by="colourBy" uniform={design.colour ?? materialById(design.material).colour}
          label="colour" undo="Back to one colour"
          set={set} format={() => null} />
      </Group>

      <Group title="Prominence"
        note="Which panel runs past which at each corner. Changes panel sizes, never internal sizes.">
        <Prominence design={design} set={set} colourByFace={colourByFace} />
      </Group>

      {/* §47 What the box carries, a layer at a time, and a way into each of
          them. The controls that add and change them are in the inspector:
          they are about one board, and the sidebar is about the box. */}
      <Group title="Panels"
        note="Open a panel here or click it in the box. Right-click a panel or an edge in the box for a menu.">
        <PanelSummary design={design} derived={derived} onInspect={onInspect} colourByFace={colourByFace} />
      </Group>

      <Group title="Edges" note="Cut from the outer face after assembly. Blank sizes do not change.">
        <Edges design={design} set={set} derived={derived} />
      </Group>
    </div>
  );
}

/**
 * §60 All twelve edges at once, and a list of any that differ.
 *
 * The sidebar used to offer a second, per-edge way of doing what a right-click
 * on the edge does — a select to add an edge, then a row to treat it. That
 * was a list of names for things that are on the screen. What is left here is
 * the uniform treatment, and a record of the edges that have been treated one
 * at a time, each with the way back to square.
 */
function Edges({ design, set, derived }) {
  const walls = derived.sol.board ?? derived.sol.wall;
  const most = largestBevel(walls);
  const ring = derived.mitreRing.length;
  const perEdge = design.edge.perEdge;
  const applied = perEdge ? treatedEdges(design) : [];

  // The uniform control means all twelve: choosing it ends any per-edge work.
  const setAll = (type) => set({ ...design, edge: { ...design.edge, type, perEdge: false, by: {} } });
  // The radius is the radius of every bevel, the per-edge ones included.
  const setRadius = (radius) => {
    const by = Object.fromEntries(Object.entries(design.edge.by).map(([k, v]) =>
      [k, v.type === "mitre" ? v : { ...v, radius }]));
    set({ ...design, edge: { ...design.edge, radius, by } });
  };

  return (
    <>
      <div className="field">
        <span>All edges</span>
        <Segmented ariaLabel="Treatment" value={perEdge ? "custom" : design.edge.type}
          onChange={setAll}
          options={[{ id: "none", name: "Square" }, { id: "chamfer", name: "Chamfer" }, { id: "fillet", name: "Fillet" }]} />
      </div>
      {/* §26 Capped at the thinnest wall on the box: a bevel bigger than the
          material it is cut from is not a bevel, and letting one be typed
          only moved the failure into the kernel. */}
      <Num label="Radius" suffix="mm" step={0.5} value={design.edge.radius} max={most}
        onChange={setRadius} />
      <p className="note">Up to {fmt(most)} mm, the thinnest wall.
        {ring > 0 ? (
          <> <button type="button" className="linkish"
            onClick={() => set(setIn(design, ["edge", "by"], mitreAll(design, derived)))}>
            Mitre a ring of {ring}
          </button></>
        ) : null}
      </p>
      {perEdge ? (
        <div className="edge-grid">
          {applied.length === 0 ? <p className="note empty">Every edge is square.</p> : null}
          {applied.map(([k, cur]) => (
            <div className="edge-row" key={k}>
              <span className="edge-key">{k.replace("|", " / ")}</span>
              <span className="edge-what">{edgeWord(cur)}</span>
              <button type="button" className="drop" aria-label={`Square ${k}`}
                title="Back to square"
                onClick={() => set(setEdgeTreatment(design, k, "none"))}>×</button>
            </div>
          ))}
          <button type="button" className="linkish" onClick={() => setAll("none")}>
            Back to one treatment
          </button>
        </div>
      ) : null}
    </>
  );
}

/** One edge's treatment, in the cut list's words. */
const edgeWord = (t) => (t.type === "mitre" ? "mitre"
  : t.type === "fillet" ? `fillet R${fmt(t.radius)}` : `chamfer ${fmt(t.radius)}`);

/**
 * §12 The largest ring of mitres this box can take, mitred; everything else
 * left as it is. A ring rather than "every mitrable edge": mitres on adjacent
 * sides of one panel rule each other out, so asking for all of them would only
 * warn about the half that lost.
 */
function mitreAll(design, derived) {
  const by = { ...design.edge.by };
  for (const k of derived.mitreRing) {
    by[k] = { ...(by[k] ?? { radius: design.edge.radius }), type: "mitre" };
  }
  return by;
}

/**
 * The box's order, and then any layer that is not laid out by it.
 *
 * §53 A doubler ring is a different piece of joinery from the carcass around
 * it, and the box's order is not always the answer to it. The control only
 * appears once there is a doubler to order — the prominence of panels that do
 * not exist is not a question — and stays while one is set, so a departure is
 * never hidden by the last doubler being taken off.
 */
function Prominence({ design, set, colourByFace }) {
  const own = ownOrder(design, "doubler");
  const doublers = FACES.filter((f) => design.doubler?.[f]);
  return (
    <>
      <OrderPicker design={design} set={set} colourByFace={colourByFace} layer="shell" />
      {doublers.length || own ? (
        <div className="layer-prominence">
          <div className="field">
            <span>Doublers</span>
            <Segmented ariaLabel="Doubler prominence" value={own ? "own" : "follow"}
              onChange={(v) => set(setOwnProminence(design, "doubler", v === "own"))}
              options={[{ id: "follow", name: "As the carcass" }, { id: "own", name: "Their own order" }]} />
          </div>
          {own ? (
            <OrderPicker design={design} set={set} colourByFace={colourByFace} layer="doubler" />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/**
 * A preset covers most boxes, so the six-face order stays folded away until it
 * is wanted. The summary line always shows the order in force, so folding it
 * back up never hides a hand-made one.
 */
function OrderPicker({ design, set, colourByFace, layer }) {
  const order = layerOrder(design, layer);
  const preset = layerPreset(design, layer);
  const [open, setOpen] = useState(preset === "custom");
  const what = layer === "shell" ? "" : ` ${LAYER_LABEL[layer].toLowerCase()}`;
  const name = (f) => `${FACE_LABEL[f]}${what}`;
  // Two of these can be on screen at once, so each says which order it folds.
  const fold = layer === "shell" ? "the order" : `the ${LAYER_LABEL[layer].toLowerCase()} order`;
  return (
    <>
      <label className="field">
        {/* Named for the layer where there is more than one of these on screen:
            two selects both labelled "Preset" is two ways to be wrong. */}
        <span>{layer === "shell" ? "Preset" : `${LAYER_LABEL[layer]} preset`}</span>
        <select value={preset}
          onChange={(e) => {
            const p = PROMINENCE_PRESETS.find((x) => x.id === e.target.value);
            if (p) set(setLayerOrder(design, layer, p.order));
          }}>
          {PROMINENCE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          {preset === "custom" ? <option value="custom">Custom</option> : null}
        </select>
      </label>

      {open ? (
        <ol className={`prominence for-${layer}`}>
          {order.map((f, i) => (
            <li key={f}>
              <span className="rank">{i}</span>
              <FaceSwatch face={f} layer={layer} on={colourByFace} />
              <span className="name">{FACE_LABEL[f]}</span>
              <span className="moves">
                <button type="button" aria-label={`Raise ${name(f)}`} disabled={i === 0}
                  onClick={() => set(moveIn(design, layer, i, -1))}>▲</button>
                <button type="button" aria-label={`Lower ${name(f)}`} disabled={i === 5}
                  onClick={() => set(moveIn(design, layer, i, 1))}>▼</button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className={`rank-summary for-${layer}`}
          aria-label={layer === "shell" ? "Prominence order, most prominent first"
            : `${LAYER_LABEL[layer]} prominence order, most prominent first`}>
          {order.map((f) => (
            <li key={f}>
              <FaceSwatch face={f} layer={layer} on={colourByFace} />
              {FACE_LABEL[f]}
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="linkish" onClick={() => setOpen(!open)}>
        {open ? `Hide ${fold}` : `Override ${fold}…`}
      </button>
    </>
  );
}

/**
 * §47 What the box carries, and a way into each of it.
 *
 * Six chips for the carcass, because every box has those six and they are the
 * way in to everything else on a face; then a line per layer naming the faces
 * that carry one. Each name opens that panel's inspector, so the summary is
 * both the answer to "what is on this box" and the route to changing it.
 *
 * A summary and not a control: nothing here edits anything, so there is one
 * place to change a board and it is the place where the board is on screen.
 * §60 A line that would say "None" is not shown: five rows of nothing under
 * six chips said less than the chips did on their own.
 */
function PanelSummary({ design, derived, onInspect, colourByFace }) {
  const indexOf = (layer, face) =>
    derived.rows.find((r) => r.layer === layer && r.face === face)?.panelIndex;
  const open = (layer, face) => { const i = indexOf(layer, face); if (i != null) onInspect(i); };

  const layerRows = ["cladding", "doubler", "lagging"].map((layer) => {
    const faces = FACES.filter((f) => design[layer]?.[f]);
    if (!faces.length) return null;
    return (
      <div key={layer}>
        <dt>{LAYER_LABEL[layer]}</dt>
        <dd>{faces.map((f) => (
          <button type="button" className="linkish" key={f}
            aria-label={`Open the ${FACE_LABEL[f]} ${LAYER_LABEL[layer].toLowerCase()}`}
            onClick={() => open(layer, f)}>{FACE_LABEL[f]}</button>
        ))}</dd>
      </div>
    );
  }).filter(Boolean);

  // §46 A rebate names a board, so the summary names it the same way the
  // warnings do — "Top doubler", not "Top".
  const rebates = Object.keys(design.rebate ?? {}).map((key) => ({ key, ...readRebateKey(key) }));
  const fittings = design.fittings ?? [];

  return (
    <>
      <div className="panel-picker">
        {FACES.map((f) => (
          <button type="button" key={f} className="panel-chip"
            aria-label={`Open the ${FACE_LABEL[f]} carcass`}
            onClick={() => open("shell", f)}>
            <FaceSwatch face={f} layer="shell" on={colourByFace} />
            {FACE_LABEL[f]}
          </button>
        ))}
      </div>
      {layerRows.length || rebates.length || fittings.length ? (
        <dl className="readout panel-summary">
          {layerRows}
          {rebates.length ? (
            <div>
              <dt>Rebated</dt>
              <dd>{rebates.map(({ key, layer, face }) => (
                <button type="button" className="linkish" key={key}
                  aria-label={`Open the rebated ${rebateLabel(layer, face)}`}
                  onClick={() => open(layer, face)}>{rebateLabel(layer, face)}</button>
              ))}</dd>
            </div>
          ) : null}
          {fittings.length ? (
            <div>
              <dt>Fittings</dt>
              <dd>{fittings.map((f, i) => (
                <button type="button" className="linkish" key={f.id ?? i}
                  aria-label={`Open the panel fitting ${i + 1} is on`}
                  onClick={() => {
                    const panel = derived.fittingPanels?.[f.face];
                    const row = derived.rows.find((r) => r.panel === panel);
                    if (row) onInspect(row.panelIndex); else open("shell", f.face);
                  }}>{FACE_LABEL[f.face]} {f.type}</button>
              ))}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </>
  );
}

/**
 * §47 Where a face has been given its own thickness or colour, and the way back.
 *
 * The six-cell grids that used to be here were the same six numbers the
 * inspector asks for one at a time, and keeping both meant a face could be
 * changed in two places. What is worth having in the sidebar is the fact that
 * the box is no longer cut from one sheet — so that is what this is: which
 * faces depart from the project, and a button that ends the departure.
 */
function Departures({ design, derived, set, on, by, uniform, label, undo, onInspect, format }) {
  if (!design[on]) return null;
  const odd = FACES.filter((f) => {
    const v = design[by]?.[f];
    return v != null && v !== uniform;
  });
  const indexOf = (face) =>
    derived.rows.find((r) => r.layer === "shell" && r.face === face)?.panelIndex;
  return (
    <p className="note">
      {odd.length ? (
        <>
          Its own {label}: {odd.map((f, i) => (
            <React.Fragment key={f}>
              {i ? ", " : ""}
              {/* No label of its own: what it says is "Front 25 mm", which is
                  a better name for it than anything a label could add. */}
              <button type="button" className="linkish"
                onClick={() => { const n = indexOf(f); if (n != null) onInspect(n); }}>
                {FACE_LABEL[f]}{format(design[by][f]) ? ` ${format(design[by][f])}` : ""}
              </button>
            </React.Fragment>
          ))}.{" "}
        </>
      ) : <>Per face, though no face differs yet. </>}
      <button type="button" className="linkish" onClick={() => set({ ...design, [on]: false })}>{undo}</button>
    </p>
  );
}

/** Swap two faces in the order that lays out `layer` — its own, or the box's. */
function moveIn(design, layer, i, d) {
  const order = [...layerOrder(design, layer)];
  [order[i], order[i + d]] = [order[i + d], order[i]];
  return setLayerOrder(design, layer, order);
}
