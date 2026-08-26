// §21 The inspector: everything about the face you have selected.
//
// The sidebar asks questions about the box — one thickness, one colour, a list
// of every fitting on it. That is the right way round for setting a box up, and
// the wrong way round once it exists and you are looking at it: the question in
// front of you is "this panel, thicker", and answering it in the sidebar means
// finding the face in a grid of six, having first found the switch that turns
// the grid on.
//
// So selecting a panel opens a second panel on the other side, about that face
// and nothing else. Its blank size, the sheet it is cut from, where it sits in
// the prominence order, its four edges, its rebate, the fittings on it, and
// whether it carries cladding or a doubler.
//
// §47 And only here: the sidebar's copies of all of that are gone, so there is
// one place to change a board and it is the place where the board is on the
// screen. What the sidebar keeps is what is true of the box.

import React from "react";
import {
  FACE_LABEL, LAYER_LABEL, MATERIALS, LAGGINGS, materialById, edgesOfFace, otherFace, edgeAxis,
} from "../model/constants.js";
import { fmt } from "../cutlist/cutlist.js";
import { Group, Num, Colour, FaceSwatch } from "./fields.jsx";
import { FittingList } from "./FittingEditor.jsx";
import { largestBevelAt } from "../model/bevel.js";
import {
  rebateSides, rebateKey, rebateLabel, rebateProblems, REBATABLE, DEFAULT_REBATE_DEPTH,
} from "../model/rebate.js";
import {
  setFaceThickness, setFaceColour, moveFace, addPanel, removePanel, editPanel,
  setEdgeTreatment, authoredEdge, setRebateSides, setRebateDepth, layerOrder, ownOrder,
} from "./design.js";


/** The layers a face could carry, outermost first — which is how they stack. */
const LAYER_ORDER = ["cladding", "shell", "doubler", "lagging"];

export default function Inspector({ design, set, derived, row, colourByFace, onSelect, onClose }) {
  const face = row.face;
  const layer = row.layer;
  const label = FACE_LABEL[face];
  // Every panel on this face, so the inspector can say what is stacked here and
  // let you step between them without going back to the box.
  const onThisFace = derived.rows.filter((r) => r.face === face);
  // §53 The rank this panel is actually laid out by. A doubler in a box whose
  // doublers have an order of their own is at whatever rank *that* order gives
  // it, and moving it moves it there — showing the carcass's rank on a panel it
  // does not govern would be a number about some other board.
  const orderLayer = ownOrder(design, layer) ? layer : "shell";
  const rank = layerOrder(design, orderLayer).indexOf(face);

  return (
    <aside className="inspector" aria-label={`${label} ${LAYER_LABEL[layer].toLowerCase()} panel`}>
      <header className="inspector-head">
        <div className="inspector-title">
          <FaceSwatch face={face} layer={layer} on={colourByFace} />
          <strong>{row.id}</strong>
          <span>{label} {LAYER_LABEL[layer].toLowerCase()}</span>
        </div>
        <button type="button" className="drop" aria-label="Close the panel inspector"
          onClick={onClose}>×</button>
      </header>

      <div className="inspector-body">
        <Group title="Blank">
          <dl className="readout">
            <div><dt>Cut</dt><dd>{fmt(row.length)} × {fmt(row.width)} × {fmt(row.thickness)}</dd></div>
            <div><dt>Area</dt><dd>{(row.area / 1e6).toFixed(3)} m²</dd></div>
            <div><dt>Sheet</dt><dd>{row.material}</dd></div>
            <div><dt>Grain</dt><dd>{row.grained ? row.grain : "None"}</dd></div>
            <div><dt>Edges</dt><dd>{row.edgeWork}</dd></div>
          </dl>
        </Group>

        <Sheet design={design} set={set} row={row} />

        <Group title="Layers on this face"
          note="Cladding lies outside the carcass and grows the box. A doubler lies inside and eats the cavity, and lagging lines it.">
          <ul className="layer-list">
            {LAYER_ORDER.map((l) => {
              const here = onThisFace.find((r) => r.layer === l);
              return (
                <li key={l} className={here ? (l === layer ? "on" : "") : "absent"}>
                  <span className="layer-name">
                    <FaceSwatch face={face} layer={l} on={colourByFace && Boolean(here)} />
                    {LAYER_LABEL[l]}
                  </span>
                  {here ? (
                    <>
                      <span className="layer-size">{fmt(here.thickness)} mm</span>
                      {l === layer ? <em>shown</em> : (
                        <button type="button" className="linkish"
                          aria-label={`Inspect the ${label} ${LAYER_LABEL[l].toLowerCase()}`}
                          onClick={() => onSelect(here.panelIndex)}>Inspect</button>
                      )}
                      {/* The carcass panel is the box. Cladding and doublers are
                          the ones that were added, so they are the ones that can
                          be taken away — and the empty cell where the × would be
                          keeps the three rows in line. */}
                      {l === "shell" ? <span /> : (
                        <button type="button" className="drop"
                          aria-label={`Remove the ${label} ${LAYER_LABEL[l].toLowerCase()}`}
                          onClick={() => set(removePanel(design, l, face))}>×</button>
                      )}
                    </>
                  ) : (
                    <button type="button" className="add-layer"
                      onClick={() => set(addPanel(design, l, face))}>
                      Add {LAYER_LABEL[l].toLowerCase()}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Group>

        <Group title="Prominence"
          note={`Rank decides which panel runs past which at every corner. Moving this face resizes the ones it meets, and changes no internal dimension.${
            orderLayer === "shell" ? "" :
            ` This is the ${LAYER_LABEL[orderLayer].toLowerCase()}s' own order, which the rest of the box does not follow.`}`}>
          <div className="rank-row">
            <span className="rank">{rank}</span>
            <span className="name">{rankNote(rank)}</span>
            <span className="moves">
              <button type="button" aria-label={`Raise ${label}`} disabled={rank === 0}
                onClick={() => set(moveFace(design, face, -1, orderLayer))}>▲</button>
              <button type="button" aria-label={`Lower ${label}`} disabled={rank === 5}
                onClick={() => set(moveFace(design, face, 1, orderLayer))}>▼</button>
            </span>
          </div>
        </Group>

        <Group title="Edges of this face"
          note="The four edges this face is one side of. A bevel needs one panel to run the whole edge; a mitre needs both to meet along it.">
          <FaceEdges design={design} set={set} derived={derived} face={face} />
        </Group>

        {/* §47 Beside the edges, because a rebate is the other way of joining
            this board to the ones around it. */}
        <Group title="Rebate"
          note="The sides of this board that are let into the panels beside them. The board grows by the depth on each side chosen, and a groove is cut in whatever it runs into.">
          <Rebate design={design} set={set} derived={derived} row={row} />
        </Group>

        <Group title="Fittings on this face"
          note="Cut through every panel on the face, positioned on the outermost one.">
          <FittingList design={design} set={set} derived={derived} face={face} />
        </Group>
      </div>
    </aside>
  );
}

/**
 * §46 The rebate on this board: which of its four sides are let in, and how deep.
 *
 * §47 moved it here from the sidebar, where it had to name the panel it was
 * about before it could ask anything. Here the panel is the thing on the
 * screen, so the control is four buttons and a number — and a rebate exists
 * because a side is chosen rather than because it was added to a list.
 *
 * What was cut and what was refused are both shown, because a rebate asked for
 * on four sides and cut on two has to account for the other two.
 */
function Rebate({ design, set, derived, row }) {
  const { face, layer } = row;
  if (!REBATABLE.includes(layer)) {
    return <p className="note">A lining is not a board: a groove in felt is a dent, and felt let into a groove is felt folded over.</p>;
  }
  const label = rebateLabel(layer, face);
  const key = rebateKey(layer, face);
  const rebate = design.rebate?.[key];
  const sides = rebateSides(face);
  const chosen = rebate?.sides ?? {};
  const all = sides.every((g) => chosen[g]);
  const depth = rebate?.depth ?? DEFAULT_REBATE_DEPTH;
  const cut = derived.rebated?.[key]?.sides ?? [];
  const refused = rebateProblems(derived.rebateRejected).filter((p) => p.key === key);
  const put = (next) => set(setRebateSides(design, key, next));
  return (
    <div className="rebate">
      <div className="chip-group">
        <button type="button" className={all ? "on" : ""}
          aria-label={`${label} rebate all sides`}
          onClick={() => put(all ? {} : Object.fromEntries(sides.map((g) => [g, true])))}>All</button>
        {sides.map((g) => (
          <button type="button" key={g} className={chosen[g] ? "on" : ""}
            aria-label={`${label} rebate ${g}`}
            onClick={() => put({ ...chosen, [g]: !chosen[g] })}>{FACE_LABEL[g]}</button>
        ))}
      </div>
      <Num label="Depth" suffix="mm" step={0.5} value={depth} disabled={!rebate}
        aria={`${label} rebate depth`}
        onChange={(v) => set(setRebateDepth(design, key, v))} />
      {cut.length ? (
        <p className="note">
          Let in {fmt(depth)} mm on {cut.map((g) => FACE_LABEL[g].toLowerCase()).join(", ")}.
        </p>
      ) : refused.length ? null : <p className="note">No sides chosen: this board stops where the panels beside it start.</p>}
      {refused.map(({ sides: bad, why }) => (
        <p className="note bad" key={why}>
          {bad.length ? `${bad.map((g) => FACE_LABEL[g]).join(", ")}: ` : ""}{why}.
        </p>
      ))}
    </div>
  );
}

/**
 * What a rank means for the panel you are looking at.
 *
 * "2 of 5" is a position in a list, and a position in a list is not the thing
 * anybody wants to know. What rank decides is which panel runs out to the
 * corner and which is fitted between two others — so that is what it says.
 */
export function rankNote(rank) {
  if (rank === 0) return "Runs past all five";
  if (rank === 5) return "Inside all five";
  return `Runs past ${5 - rank}, inside ${rank}`;
}

/**
 * The sheet this panel is cut from.
 *
 * Which question that is depends on the layer. A cladding or doubler panel owns
 * its material outright, because it was added a side at a time and there is
 * nothing to inherit from. A carcass panel is one of six cut from the project
 * sheet, so its material is the project's and only its thickness and colour can
 * be its own — and setting either switches on the per-face override rather than
 * quietly moving all six (§21).
 */
function Sheet({ design, set, row }) {
  const { face, layer } = row;
  const label = FACE_LABEL[face];
  if (layer === "shell") {
    const uniform = !design.perFaceThickness;
    return (
      <Group title="Sheet"
        note={uniform ? "The carcass is one sheet. Changing this face's thickness sets it for this face alone and leaves the others where they are." : null}>
        <p className="note">{materialById(design.material).name}, the project sheet.</p>
        <Num label="Thickness" suffix="mm" step={0.5}
          aria={`${label} thickness`} list={`th-${design.material}`}
          value={uniform ? design.thickness : design.thicknessBy[face]}
          onChange={(v) => set(setFaceThickness(design, face, v))} />
        <Colour label="Colour" aria={label} material={design.material}
          value={design.colourBy?.[face] ?? null} inheritLabel="As the project"
          inherit={design.colour ?? materialById(design.material).colour}
          onChange={(hex) => set(setFaceColour(design, face, hex))} />
      </Group>
    );
  }

  const entry = design[layer]?.[face];
  if (!entry) return null;
  const name = LAYER_LABEL[layer];
  // §30 A lining comes off a roll, not out of a sheet: felt and wadding and
  // bitumen, and no birch ply among them.
  const sheets = layer === "lagging" ? LAGGINGS : MATERIALS;
  return (
    <Group title="Sheet" note={`This ${name.toLowerCase()} carries its own sheet.`}>
      <label className="field">
        <span>Sheet</span>
        <select value={entry.material} aria-label={`${name} ${label} material`}
          onChange={(e) => set(editPanel(design, layer, face, { material: e.target.value }))}>
          {sheets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <Num label="Thickness" suffix="mm" step={0.5} value={entry.thickness}
        aria={`${name} ${label} thickness`} list={`th-${entry.material}`}
        onChange={(v) => set(editPanel(design, layer, face, { thickness: v }))} />
      <Colour label="Colour" aria={`${name} ${label}`} material={entry.material}
        value={entry.colour ?? null} inheritLabel="As the sheet comes"
        inherit={materialById(entry.material).colour}
        onChange={(hex) => set(editPanel(design, layer, face, { colour: hex }))} />
    </Group>
  );
}

/**
 * The four edges of one face.
 *
 * Named by the face across the corner rather than by their key: from the front
 * panel, `front|left` is "the left edge", and reading it as "front / left" is
 * asking somebody to work out which of the two faces they are standing on.
 */
function FaceEdges({ design, set, derived, face }) {
  return (
    <div className="edge-grid">
      {edgesOfFace(face).map((key) => {
        // The authored treatment rather than the applicable one: an edge asked
        // for a fillet it cannot take still shows the fillet it was asked for,
        // and the message that says why is in the panel below the box.
        const { type, radius } = authoredEdge(design, key);
        const across = otherFace(key, face);
        const canBevel = derived.fullLength[key];
        const canMitre = derived.mitrable[key]?.ok;
        return (
          <div className="edge-row" key={key}>
            <span className="edge-key">
              {FACE_LABEL[across]} edge
              <em>{canBevel || canMitre ? `runs ${edgeAxis(key)}` : "broken by other panels"}</em>
            </span>
            <select value={type} aria-label={`${FACE_LABEL[face]} ${across} edge treatment`}
              onChange={(e) => set(setEdgeTreatment(design, key, e.target.value, radius))}>
              <option value="none">Square</option>
              <option value="chamfer" disabled={!canBevel}>Chamfer</option>
              <option value="fillet" disabled={!canBevel}>Fillet</option>
              <option value="mitre" disabled={!canMitre}>Mitre</option>
            </select>
            {/* §26 The same cap as the sidebar's: the thinner of the two
                walls this edge joins. */}
            <input type="number" min="0" step="0.5" value={radius}
              disabled={type === "mitre" || type === "none"}
              max={largestBevelAt(derived.sol.board ?? derived.sol.wall, key)}
              aria-label={`${FACE_LABEL[face]} ${across} edge radius`}
              onChange={(e) => set(setEdgeTreatment(design, key, type,
                Math.min(Number(e.target.value) || 0, largestBevelAt(derived.sol.board ?? derived.sol.wall, key))))} />
          </div>
        );
      })}
    </div>
  );
}
