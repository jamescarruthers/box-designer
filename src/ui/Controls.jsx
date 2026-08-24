// §7 Control groups: starting point, material, prominence, reinforcement, edge treatment.

import React, { useState } from "react";
import { FACES, FACE_LABEL, MATERIALS, LAGGINGS, PROMINENCE_PRESETS, EDGES, edgeAxis, materialById } from "../model/constants.js";
import { ROUND_STEPS } from "../model/solver.js";
import { setIn, freeFaces, addPanel, removePanel, editPanel, setProjectMaterial, setProjectThickness, setEdgeTreatment, treatedEdges } from "./design.js";
import { largestBevel, largestBevelAt } from "../model/bevel.js";
import { Group, Num, Colour, Segmented, FaceSwatch, StockThicknesses } from "./fields.jsx";
import { FittingList } from "./FittingEditor.jsx";
import { fmt } from "../cutlist/cutlist.js";

export default function Controls({ design, set, derived, colourByFace }) {
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
        <Colour label="Colour" aria="Sheet" material={design.material} value={design.colour}
          onChange={(hex) => set({ ...design, colour: hex })} />
        <label className="check">
          <input type="checkbox" checked={design.perPanelColour}
            onChange={(e) => set({ ...design, perPanelColour: e.target.checked })} />
          <span>Colour per panel</span>
        </label>
        {design.perPanelColour ? (
          <div className="colour-grid">
            {FACES.map((f) => (
              <Colour key={f} label={FACE_LABEL[f]} aria={FACE_LABEL[f]} material={design.material}
                value={design.colourBy?.[f] ?? null} inheritLabel="As the sheet"
                inherit={design.colour ?? materialById(design.material).colour}
                onChange={(hex) => set(setIn(design, ["colourBy", f], hex))} />
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

      {/* §30 Its own group rather than a third stack under Reinforcement: felt
          reinforces nothing. It is added the same way and sized the same way,
          and it is chosen from the linings rather than from the sheets. */}
      <Group title="Lagging" note="Lining on the inside of the box, a face at a time. It sits inside the doublers and takes its thickness out of the cavity, so a box sized to a volume grows to keep it.">
        <LayerStack design={design} set={set} layer="lagging" title="Lagging"
          colourByFace={colourByFace} materials={LAGGINGS} />
      </Group>

      <Group title="Fittings" note="Drivers and ports are cut into the outermost panel of their face. Position is measured from the panel's own low corner, so it reads straight off the face-on view — or as a percentage across it, which keeps a centred driver centred when the box changes size.">
        <FittingList design={design} set={set} derived={derived} />
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
function LayerStack({ design, set, layer, title, colourByFace, materials = MATERIALS }) {
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
                  {materials.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <input type="color" className="stack-colour"
                  value={entry.colour ?? materialById(entry.material).colour}
                  aria-label={`${title} ${FACE_LABEL[face]} colour`}
                  onChange={(e) => set(editPanel(design, layer, face, { colour: e.target.value }))} />
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

function move(design, set, i, d) {
  const order = [...design.order];
  [order[i], order[i + d]] = [order[i + d], order[i]];
  const match = PROMINENCE_PRESETS.find((p) => p.order.join() === order.join());
  set({ ...design, order, preset: match ? match.id : "custom" });
}
