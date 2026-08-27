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

import {
  FACE_LABEL, LAYER_LABEL, FACES, MATERIALS, LAGGINGS, materialById, paletteFor, colourName,
} from "../model/constants.js";
import { pickableEdges } from "../three/edgePick.js";
import {
  addPanel, removePanel, setEdgeTreatment, authoredEdge, setFaceRank,
  layerOrder, prominenceLayer, setFaceThickness, setFaceColour, editPanel, setProjectMaterial,
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
 * §59 The pages a panel's menu can turn to.
 *
 * A board comes in five sheets, nine thicknesses and twelve colours, and a flat
 * menu of all of them would be a scrolling wall. Nested flyouts are the usual
 * answer and the wrong one here: they are fiddly with a pointer and worse with
 * a keyboard. So the menu turns a *page* — the same popup, showing one list,
 * with the way back at the top. One thing on screen at a time, and every page
 * is still a plain list.
 */
export const PAGES = ["board", "thickness", "colour"];

/**
 * The menu for whatever the pointer was on, or null for nothing.
 *
 * `target` is `{ kind: "edge", key }` or `{ kind: "panel", index }` — what the
 * view hit, not what it drew. `page` is which of §59's pages is open, or null
 * for the menu itself. Everything else is worked out here.
 */
export function contextMenu(design, derived, target, page = null) {
  if (target?.kind === "edge") return edgeMenu(design, derived, target.key);
  if (target?.kind === "panel") {
    const row = derived.rows.find((r) => r.panelIndex === target.index);
    if (!row) return null;
    return page ? sheetPage(design, row, page) : panelMenu(design, row);
  }
  return null;
}

/**
 * §59 What sheet a panel is cut from, and how the design says so.
 *
 * The carcass has one sheet for all six faces (§47), so changing a carcass
 * panel's board changes the project's — said on the item rather than left to be
 * discovered. Its thickness and colour are per face and switch their own
 * override on as they write. A cladding, doubler or lagging panel carries its
 * own of all three.
 */
function sheetOf(design, row) {
  const { face, layer } = row;
  if (layer === "shell") {
    return {
      materialId: design.material,
      thickness: design.perFaceThickness ? design.thicknessBy[face] : design.thickness,
      colour: design.colourBy?.[face] ?? null,
      inherited: design.colour ?? materialById(design.material).colour,
      inheritLabel: "As the project",
      // The carcass is one sheet: this is the project's board, not this face's.
      shared: true,
      sheets: MATERIALS,
      setMaterial: (d, id) => setProjectMaterial(d, id),
      setThickness: (d, v) => setFaceThickness(d, face, v),
      setColour: (d, hex) => setFaceColour(d, face, hex),
    };
  }
  const entry = design[layer]?.[face];
  if (!entry) return null;
  return {
    materialId: entry.material,
    thickness: entry.thickness,
    colour: entry.colour ?? null,
    inherited: materialById(entry.material).colour,
    inheritLabel: "As the sheet comes",
    shared: false,
    // §30 A lining comes off a roll, not out of a sheet.
    sheets: layer === "lagging" ? LAGGINGS : MATERIALS,
    setMaterial: (d, id) => editPanel(d, layer, face, { material: id }),
    setThickness: (d, v) => editPanel(d, layer, face, { thickness: v }),
    setColour: (d, hex) => editPanel(d, layer, face, { colour: hex }),
  };
}

/** One page of §59: a list of what this panel could be, and the way back. */
function sheetPage(design, row, page) {
  const sheet = sheetOf(design, row);
  if (!sheet || !PAGES.includes(page)) return null;
  const name = `${FACE_LABEL[row.face]} ${LAYER_LABEL[row.layer].toLowerCase()}`;
  const back = { id: "back", label: "Back", back: true };

  if (page === "board") {
    return {
      kind: "page", page, title: `${name} · sheet`, back: true,
      groups: [{ name: null, items: [back] }, { name: sheet.shared ? "The whole carcass" : null,
        items: sheet.sheets.map((m) => ({
          id: m.id,
          label: m.name,
          note: `${fmt(m.thickness)} mm as standard`,
          on: m.id === sheet.materialId,
          disabled: m.id === sheet.materialId,
          apply: (d) => sheet.setMaterial(d, m.id),
        })) }],
    };
  }

  if (page === "thickness") {
    const m = materialById(sheet.materialId);
    return {
      kind: "page", page, title: `${name} · ${m.name.toLowerCase()}`, back: true,
      groups: [{ name: null, items: [back] }, { name: "Thickness", items: m.thicknesses.map((t) => ({
        id: `t${t}`,
        label: `${fmt(t)} mm`,
        on: Math.abs(t - sheet.thickness) < 1e-9,
        disabled: Math.abs(t - sheet.thickness) < 1e-9,
        apply: (d) => sheet.setThickness(d, t),
      })) }],
    };
  }

  const palette = paletteFor(sheet.materialId) ?? [];
  const items = [
    {
      id: "inherit",
      label: sheet.inheritLabel,
      swatch: sheet.inherited,
      on: sheet.colour === null,
      disabled: sheet.colour === null,
      apply: (d) => sheet.setColour(d, null),
    },
    ...palette.map((c) => ({
      id: c.id,
      label: c.name,
      swatch: c.hex,
      on: String(sheet.colour).toLowerCase() === c.hex.toLowerCase(),
      disabled: String(sheet.colour).toLowerCase() === c.hex.toLowerCase(),
      apply: (d) => sheet.setColour(d, c.hex),
    })),
  ];
  return {
    kind: "page", page, title: `${name} · colour`, back: true,
    groups: [{ name: null, items: [back] }, { name: palette.length ? "The range" : null, items }],
  };
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
function panelMenu(design, row) {
  const { face, layer, panelIndex: index } = row;
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

  // §59 What the board itself is. Three pages rather than three lists, since
  // between them they are twenty-six things and this is a menu.
  const sheet = sheetOf(design, row);
  const material = sheet ? materialById(sheet.materialId) : null;
  const palette = sheet ? paletteFor(sheet.materialId) : null;
  const colourNow = sheet?.colour
    ? colourName(sheet.materialId, sheet.colour) ?? String(sheet.colour).toLowerCase()
    : sheet?.inheritLabel.toLowerCase();
  const board = sheet ? [
    { id: "board", label: "Sheet", note: material.name, into: "board" },
    { id: "thickness", label: "Thickness", note: `${fmt(sheet.thickness)} mm`, into: "thickness" },
    {
      id: "colour", label: "Colour", note: colourNow, swatch: sheet.colour ?? sheet.inherited,
      into: "colour",
      // A sheet sold in one colour has no range to choose from. The inspector
      // can still paint it any hex somebody likes; a menu cannot hold a colour
      // picker, and pretending otherwise is a page with one line on it.
      disabled: !palette,
      why: palette ? null : `${material.name.toLowerCase()} comes as it comes — paint it in the inspector`,
    },
  ] : [];

  return {
    kind: "panel",
    title: `${name} ${LAYER_LABEL[layer].toLowerCase()}`,
    face,
    layer,
    groups: [
      { name: "This board", items: board },
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
