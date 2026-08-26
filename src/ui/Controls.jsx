// §7 Control groups: starting point, material, prominence, edge treatment, drawing.
//
// §47 The sidebar is about the box and the inspector is about one board, and
// nothing is in both. What was here a face at a time — a panel's thickness, its
// colour, the cladding or doubler or lagging on it, its rebate, its fittings —
// is in the inspector now, where the panel it belongs to is the thing on the
// screen. What is left is a summary: what the box carries and where, with every
// entry a way into the panel that owns it.

import React, { useState } from "react";
import { FACES, FACE_LABEL, LAYER_LABEL, MATERIALS, PROMINENCE_PRESETS, EDGES, edgeAxis, materialById } from "../model/constants.js";
import { ROUND_STEPS } from "../model/solver.js";
import { setIn, setProjectMaterial, setProjectThickness, setEdgeTreatment, treatedEdges,
  layerOrder, layerPreset, ownOrder, setLayerOrder, setOwnProminence } from "./design.js";
import { largestBevel, largestBevelAt } from "../model/bevel.js";
import { readRebateKey, rebateLabel } from "../model/rebate.js";
import { Group, Num, Colour, Segmented, FaceSwatch, StockThicknesses } from "./fields.jsx";
import { fmt } from "../cutlist/cutlist.js";

export default function Controls({ design, set, derived, colourByFace, onInspect }) {
  const s = design.start;
  const cuttable = Object.values(derived.fullLength).filter(Boolean).length;
  const mitrable = Object.values(derived.mitrable).filter((c) => c.ok).length;
  const ring = derived.mitreRing.length;
  // §15 Only what has been done to the box. Twelve rows of "Square" was a list
  // of everything that could happen, which is not a list of anything.
  const applied = treatedEdges(design);
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
        <label className="field">
          <span>Stock</span>
          <select value={design.stockIndex} onChange={(e) => set({ ...design, stockIndex: Number(e.target.value) })}>
            {derived.material.stock.map((st, i) => <option key={i} value={i}>{st[0]} × {st[1]}</option>)}
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

      {/* §47 What the box carries, a layer at a time, and a way into each of
          them. The controls that add and change them are in the inspector:
          they are about one board, and the sidebar is about the box. */}
      <Group title="Panels"
        note="Everything about one board — its sheet, thickness and colour, the cladding, doubler or lagging on its face, its rebate and its fittings — is in the inspector. Open one from here, or click a panel in the box.">
        <PanelSummary design={design} derived={derived} onInspect={onInspect} colourByFace={colourByFace} />
      </Group>

      <Group title="Edge treatment" note="Cut from the outer face after assembly. Blank sizes are unchanged.">
        <p className="note">{cuttable} of 12 edges run the full length of one panel. The rest stay square: a bevel would stop against the side of the next panel.</p>
        <Segmented ariaLabel="Treatment" value={design.edge.type}
          onChange={(v) => set(setIn(design, ["edge", "type"], v))}
          options={[{ id: "none", name: "Square" }, { id: "chamfer", name: "Chamfer" }, { id: "fillet", name: "Fillet" }]} />
        {/* §26 Capped at the thinnest wall on the box: a bevel bigger than the
            material it is cut from is not a bevel, and letting one be typed
            only moved the failure into the kernel. */}
        <Num label="Radius" suffix="mm" step={0.5} value={design.edge.radius}
          max={largestBevel(derived.sol.board ?? derived.sol.wall)}
          onChange={(v) => set(setIn(design, ["edge", "radius"], v))} />
        <p className="note">Up to {fmt(largestBevel(derived.sol.board ?? derived.sol.wall))} mm: a bevel has to leave material behind it, and this applies to every edge, so the thinnest wall sets the limit.</p>
        <label className="check">
          <input type="checkbox" checked={design.edge.perEdge}
            onChange={(e) => set(setIn(design, ["edge", "perEdge"], e.target.checked))} />
          <span>Per edge</span>
        </label>
        {design.edge.perEdge ? (
          <>
            <p className="note">
              Click an edge in the 3D view with a treatment armed to add one here.
              {" "}{mitrable} of 12 can take a mitre: the two panels have to meet along the whole
              edge and be the same thickness, and a panel takes mitres on opposite sides, not
              adjacent ones — so choosing one closes others off.
              {ring > 0 ? (
                <> <button type="button" className="linkish"
                  onClick={() => set(setIn(design, ["edge", "by"], mitreAll(design, derived)))}>
                  Mitre a ring of {ring}
                </button></>
              ) : null}
            </p>
            <label className="field">
              <span>Add an edge</span>
              <select value="" aria-label="Add an edge treatment"
                onChange={(e) => { if (e.target.value) set(addEdge(design, derived, e.target.value)); }}>
                <option value="">Choose an edge…</option>
                {EDGES.filter((k) => !applied.some(([a]) => a === k)).map((k) => (
                  <option key={k} value={k}
                    disabled={!derived.fullLength[k] && !derived.mitrable[k]?.ok}>
                    {k.replace("|", " / ")}
                  </option>
                ))}
              </select>
            </label>
            {applied.length === 0 ? (
              <p className="note empty">Every edge is square.</p>
            ) : (
              <div className="edge-grid">
                {applied.map(([k, cur]) => {
                  const canBevel = derived.fullLength[k];
                  const canMitre = derived.mitrable[k]?.ok;
                  return (
                    <div className="edge-row" key={k}>
                      <span className="edge-key">{k.replace("|", " / ")}
                        <em>{edgeNote(k, canBevel, canMitre, derived)}</em></span>
                      <select value={cur.type} aria-label={`${k} treatment`}
                        onChange={(e) => set(setEdgeTreatment(design, k, e.target.value, cur.radius))}>
                        <option value="none">Square</option>
                        <option value="chamfer" disabled={!canBevel}>Chamfer</option>
                        <option value="fillet" disabled={!canBevel}>Fillet</option>
                        <option value="mitre" disabled={!canMitre}>Mitre</option>
                      </select>
                      <input type="number" min="0" step="0.5" value={cur.radius ?? design.edge.radius}
                        disabled={cur.type === "mitre"}
                        max={largestBevelAt(derived.sol.board ?? derived.sol.wall, k)}
                        aria-label={`${k} radius`}
                        onChange={(e) => set(setEdgeTreatment(design, k, cur.type,
                          Math.min(Number(e.target.value) || 0, largestBevelAt(derived.sol.board ?? derived.sol.wall, k))))} />
                      <button type="button" className="drop" aria-label={`Square ${k}`}
                        title="Back to square"
                        onClick={() => set(setEdgeTreatment(design, k, "none"))}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </Group>

      <Group title="Drawing" note="Section A–A is cut on a vertical plane and viewed from the left. Move it for a port or an off-centre brace.">
        {/* §32 What goes on the sheet. §38 The isometric keeps its column
            either way now; what dropping the section frees is the height its
            own row was taking, which every view on the sheet shares. */}
        <label className="check">
          <input type="checkbox" checked={derived.drawing.section}
            onChange={(e) => set(setIn(design, ["drawing", "section"], e.target.checked))} />
          <span>Section A–A</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={derived.drawing.insulation}
            onChange={(e) => set(setIn(design, ["drawing", "insulation"], e.target.checked))} />
          <span>Acoustic insulation</span>
        </label>
        {/* §38 The isometric comes apart. It is the one view that shows the
            whole box, so it is the one worth pulling open — a laminated wall
            explains itself in an exploded picture the way no elevation can. */}
        <div className="chip-group explode">
          <label htmlFor="iso-explode">Explode isometric</label>
          <input id="iso-explode" type="range" min="0" max="120" step="5"
            value={derived.drawing.explode}
            onChange={(e) => set(setIn(design, ["drawing", "explode"], Number(e.target.value)))} />
          <output>{derived.drawing.explode}</output>
        </div>
        <Num label="Section at x" suffix="mm" step={1} value={Math.round(derived.sectionAt * 10) / 10}
          disabled={!derived.drawing.section}
          onChange={(v) => set({ ...design, sectionAt: v })} />
        <button type="button" className="linkish" disabled={!derived.drawing.section}
          onClick={() => set({ ...design, sectionAt: null })}>
          Centre the section plane
        </button>
      </Group>
    </div>
  );
}

/**
 * §15 The treatment a newly added edge starts with: whatever the uniform
 * setting is if that edge can take it, else the only thing it can take. Adding
 * an edge and being told it cannot have what it was given would be a poor
 * welcome.
 */
function addEdge(design, derived, key) {
  const canBevel = derived.fullLength[key];
  const wanted = design.edge.type !== "none" && canBevel ? design.edge.type : null;
  const type = wanted ?? (canBevel ? "fillet" : "mitre");
  return setEdgeTreatment(design, key, type, design.edge.radius);
}

/**
 * What is available on one edge, and why the rest is not.
 *
 * The reason is cut to its first clause: the full one explains the rule as well
 * as the case, and five lines of rule under one row buried the row. The rule is
 * in the note above the list, where it is said once.
 */
function edgeNote(key, canBevel, canMitre, derived) {
  const brief = (why) => String(why ?? "").split(" — ")[0];
  if (canBevel && canMitre) return `runs ${edgeAxis(key)}`;
  if (canBevel) return `bevel only — ${brief(derived.mitrable[key].why)}`;
  if (canMitre) return "mitre only — no one panel runs this edge";
  return "broken by other panels";
}

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
          <p className="note">
            The doublers are laid out inside the carcass, and which of them runs past
            which at a corner is asked again there.{" "}
            {doublers.length < 2 ? "With one doubler there is nothing for it to run past yet." : ""}
          </p>
          <Segmented ariaLabel="Doubler prominence" value={own ? "own" : "follow"}
            onChange={(v) => set(setOwnProminence(design, "doubler", v === "own"))}
            options={[{ id: "follow", name: "As the carcass" }, { id: "own", name: "Their own order" }]} />
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
 */
function PanelSummary({ design, derived, onInspect, colourByFace }) {
  const indexOf = (layer, face) =>
    derived.rows.find((r) => r.layer === layer && r.face === face)?.panelIndex;
  const open = (layer, face) => { const i = indexOf(layer, face); if (i != null) onInspect(i); };

  const layerRow = (layer) => {
    const faces = FACES.filter((f) => design[layer]?.[f]);
    return (
      <div key={layer}>
        <dt>{LAYER_LABEL[layer]}</dt>
        <dd>{faces.length ? faces.map((f) => (
          <button type="button" className="linkish" key={f}
            aria-label={`Open the ${FACE_LABEL[f]} ${LAYER_LABEL[layer].toLowerCase()}`}
            onClick={() => open(layer, f)}>{FACE_LABEL[f]}</button>
        )) : <span className="none">None</span>}</dd>
      </div>
    );
  };

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
      <dl className="readout panel-summary">
        {["cladding", "doubler", "lagging"].map(layerRow)}
        <div>
          <dt>Rebated</dt>
          <dd>{rebates.length ? rebates.map(({ key, layer, face }) => (
            <button type="button" className="linkish" key={key}
              aria-label={`Open the rebated ${rebateLabel(layer, face)}`}
              onClick={() => open(layer, face)}>{rebateLabel(layer, face)}</button>
          )) : <span className="none">None</span>}</dd>
        </div>
        <div>
          <dt>Fittings</dt>
          <dd>{fittings.length ? fittings.map((f, i) => (
            <button type="button" className="linkish" key={f.id ?? i}
              aria-label={`Open the panel fitting ${i + 1} is on`}
              onClick={() => {
                const panel = derived.fittingPanels?.[f.face];
                const row = derived.rows.find((r) => r.panel === panel);
                if (row) onInspect(row.panelIndex); else open("shell", f.face);
              }}>{FACE_LABEL[f.face]} {f.type}</button>
          )) : <span className="none">None</span>}</dd>
        </div>
      </dl>
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
