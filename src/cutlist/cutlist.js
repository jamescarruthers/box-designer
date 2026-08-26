// §5 Cut list, parts and sheets.

import { LAYERS, FACE_LABEL, LAYER_LABEL, colourName, paletteFor, materialById, stockColour }
  from "../model/constants.js";
import { panelBlank, panelThickness, boxVolume } from "../model/solver.js";
import { panelBevels, panelEdgeNote } from "../model/bevel.js";


/**
 * Sort by layer, then by area descending, and number after sorting so the
 * numbering is stable.
 */
export function buildCutList(sol, edges, owners, { specFor, grainLocked }) {
  const rows = sol.panels
    .map((panel, index) => {
      const blank = panelBlank(panel);
      return {
        panel, index, blank,
        area: blank.length * blank.width,
        thickness: panelThickness(panel),
        bevels: panelBevels(index, panel, edges, owners),
      };
    })
    .sort((a, b) =>
      LAYERS.indexOf(a.panel.layer) - LAYERS.indexOf(b.panel.layer) ||
      b.area - a.area ||
      a.panel.face.localeCompare(b.panel.face))
    .map((r, i) => {
      const spec = specFor(r.panel);
      const locked = grainLocked && spec.grained;
      return {
        id: `P${String(i + 1).padStart(2, "0")}`,
        face: r.panel.face,
        faceLabel: FACE_LABEL[r.panel.face],
        layer: r.panel.layer,
        layerLabel: LAYER_LABEL[r.panel.layer],
        length: r.blank.length,
        width: r.blank.width,
        thickness: r.thickness,
        area: r.area,
        materialId: spec.materialId,
        material: spec.material,
        colour: spec.colour,
        // §50 What to call that colour where somebody has to order it or ask
        // for it by name at a counter.
        colourNote: colourNote(spec.materialId, spec.colour),
        grained: spec.grained,
        grainLocked: locked,
        grain: locked ? "Locked, along length" : "Free",
        edgeWork: panelEdgeNote(r.bevels) || "—",
        // §48 The treatments themselves, not just the sentence about them: the
        // DXF marks the edge each one is on, and it cannot get that back out
        // of "45° all".
        bevels: r.bevels,
        panel: r.panel,
        panelIndex: r.index,
      };
    });

  return rows;
}

export function cutListTotals(rows, sheets, closure, exact = closure === 0) {
  // §50 Grouped by the stock a part is cut from, which for a sheet sold in a
  // range of colours includes which colour: two of them are two orders.
  const byMaterial = new Map();
  for (const r of rows) {
    const k = stockKey(r);
    const cur = byMaterial.get(k) ?? { materialId: r.materialId, material: r.material,
      thickness: r.thickness, colour: r.colour, colourNote: r.colourNote, parts: 0, area: 0, sheets: 0 };
    cur.parts++;
    cur.area += r.area / 1e6;
    byMaterial.set(k, cur);
  }
  for (const s of sheets) {
    const cur = byMaterial.get(stockKey(s));
    if (cur) cur.sheets++;
  }
  return {
    parts: rows.length,
    area: rows.reduce((a, r) => a + r.area, 0) / 1e6,
    sheets: sheets.length,
    closure: exact ? "exact" : closure.toExponential(3),
    byMaterial: [...byMaterial.values()].sort((a, b) => b.area - a.area),
  };
}

/**
 * §50 The stock a part or a sheet belongs to: material, thickness, and the
 * colour where the colour is part of the stock rather than a finish.
 */
export const stockKey = (r) =>
  `${r.materialId ?? "default"}|${r.thickness}|${stockColour(r.materialId, r.colour)}`;

const csvCell = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * §50 What a part's colour is worth saying.
 *
 * A sheet sold in a range is named — "Green Mint", and the merchant knows what
 * you mean. A colour of that range's material that is not one of them is a
 * finish somebody has chosen, so the hex is the only honest answer. And a sheet
 * that comes as it comes says nothing at all: "birch" in the colour column of a
 * list whose material column already says Birch ply is a column doing no work.
 */
export function colourNote(materialId, colour) {
  if (!colour) return "";
  const named = colourName(materialId, colour);
  if (named) return named;
  if (paletteFor(materialId)) return String(colour).toLowerCase();
  const own = materialById(materialId).colour;
  return String(colour).toLowerCase() === String(own).toLowerCase() ? "" : String(colour).toLowerCase();
}

export function cutListCsv(rows) {
  // §45 The rebate goes in the sheet somebody takes to the saw, not only on
  // the screen: it is work to do to the board, the same as the edge treatment.
  // §50 And the colour beside the material, because on a sheet sold in twelve
  // of them the material alone does not say which board to cut the part from.
  const head = ["Part", "Face", "Layer", "Length mm", "Width mm", "Thickness mm",
    "Material", "Colour", "Grain", "Edge work", "Rebate"];
  const body = rows.map((r) => [r.id, r.faceLabel, r.layerLabel,
    fmt(r.length), fmt(r.width), fmt(r.thickness), r.material, r.colourNote ?? "",
    r.grain, r.edgeWork, r.rebate ?? ""]);
  return [head, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
}

export const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));

export const panelVolume = (p) => boxVolume(p.box);
