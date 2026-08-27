// §58 What a right-click on the box offers.
//
// The sidebar and the inspector are lists of everything the box could have.
// That is the right shape for reading a design and the wrong one for changing
// the thing under the pointer: adding a doubler to the front meant finding the
// front in a list of six, and mitring one edge meant arming a tool from a strip
// of chips and then aiming at the edge again. A menu on the thing itself is the
// short way round — you have already pointed at what you mean.
//
// The whole of the decision is here, as data, and none of it in the component
// that shows it. What a right-click offers, what it refuses and why are the
// questions worth testing, and none of them need a canvas to answer.

import { FACE_LABEL, LAYER_LABEL, FACES } from "../model/constants.js";
import { pickableEdges } from "../three/edgePick.js";
import {
  addPanel, removePanel, setEdgeTreatment, authoredEdge, setFaceRank,
  layerOrder, prominenceLayer,
} from "./design.js";
import { fmt } from "../cutlist/cutlist.js";

/** The four things an edge can be, in the order a person reads them. */
export const EDGE_TREATMENTS = [
  { id: "none", name: "Square" },
  { id: "chamfer", name: "Chamfer" },
  { id: "fillet", name: "Fillet" },
  { id: "mitre", name: "Mitre" },
];

/** The layers a face can be given from here. The carcass is not one: it is the box. */
export const ADDABLE = ["cladding", "doubler", "lagging"];

/**
 * The menu for whatever the pointer was on, or null for nothing.
 *
 * `target` is `{ kind: "edge", key }` or `{ kind: "panel", index }` — what the
 * view hit, not what it drew. Everything else is worked out here.
 */
export function contextMenu(design, derived, target) {
  if (target?.kind === "edge") return edgeMenu(design, derived, target.key);
  if (target?.kind === "panel") return panelMenu(design, derived, target.index);
  return null;
}

/**
 * An edge: the four treatments, with the ones this edge cannot take greyed and
 * saying why.
 *
 * §15's rules, unchanged — a bevel needs one panel running the whole edge and a
 * mitre needs both to run it together — but asked of the edge you are pointing
 * at instead of of all twelve at once.
 */
function edgeMenu(design, derived, key) {
  const [f1, f2] = String(key).split("|");
  if (!FACE_LABEL[f1] || !FACE_LABEL[f2]) return null;
  const cur = authoredEdge(design, key);
  const items = EDGE_TREATMENTS.map((t) => {
    const can = pickableEdges(t.id, derived)[key] ?? { ok: false };
    const on = cur.type === t.id;
    return {
      id: t.id,
      label: t.id === "chamfer" || t.id === "fillet"
        ? `${t.name} R${fmt(cur.radius)}` : t.name,
      on,
      // The one it already is stays readable rather than clickable: choosing
      // what is already chosen is not a thing to offer.
      disabled: !can.ok || on,
      why: can.ok ? null : can.why,
      apply: (d) => setEdgeTreatment(d, key, t.id, d.edge.radius),
    };
  });
  return {
    kind: "edge",
    title: `${FACE_LABEL[f1]} / ${FACE_LABEL[f2]} edge`,
    groups: [{ name: "Edge treatment", items }],
  };
}

/**
 * A panel: what its face carries, where it sits in the order, and the way in to
 * everything else.
 *
 * The face is the clicked panel's face, whichever layer was clicked — right-
 * clicking the front cladding and adding a doubler adds it to the front, which
 * is the only thing "add a doubler here" can mean.
 */
function panelMenu(design, derived, index) {
  const row = derived.rows.find((r) => r.panelIndex === index);
  if (!row) return null;
  const { face, layer } = row;
  const name = FACE_LABEL[face];

  const layers = ADDABLE.map((l) => {
    const here = Boolean(design[l]?.[face]);
    const word = LAYER_LABEL[l].toLowerCase();
    return {
      id: `${here ? "remove" : "add"}-${l}`,
      label: here ? `Remove the ${word}` : `Add ${word}`,
      // §30 A lining is not a board and the carcass is not optional; both are
      // said where they are true rather than left to be discovered.
      apply: (d) => (here ? removePanel(d, l, face) : addPanel(d, l, face)),
    };
  });

  // §53 The order that lays *this* panel out, which for a doubler in a box
  // whose doublers have their own is not the box's.
  const orderLayer = prominenceLayer(design, layer);
  const order = layerOrder(design, orderLayer);
  const rank = order.indexOf(face);
  const last = order.length - 1;
  const of = orderLayer === "shell" ? "" : ` of the ${LAYER_LABEL[orderLayer].toLowerCase()}s`;
  const prominence = [
    {
      id: "front",
      label: `Bring to the front${of}`,
      note: "runs past all five",
      disabled: rank === 0,
      why: rank === 0 ? `the ${name.toLowerCase()} already runs past all five` : null,
      apply: (d) => setFaceRank(d, face, 0, orderLayer),
    },
    {
      id: "back",
      label: `Send to the back${of}`,
      note: "sits inside all five",
      disabled: rank === last,
      why: rank === last ? `the ${name.toLowerCase()} is already inside all five` : null,
      apply: (d) => setFaceRank(d, face, last, orderLayer),
    },
  ];

  return {
    kind: "panel",
    title: `${name} ${LAYER_LABEL[layer].toLowerCase()}`,
    face,
    layer,
    groups: [
      { name: "On this face", items: layers },
      { name: "Prominence", items: prominence },
      { name: null, items: [{ id: "inspect", label: "Open the inspector", inspect: index }] },
    ],
  };
}

/** Every item of every group, which is what a keyboard walks. */
export const menuItems = (menu) => (menu?.groups ?? []).flatMap((g) => g.items);

/** Whether a face is one of the six, for a caller holding a string. */
export const isFace = (f) => FACES.includes(f);
