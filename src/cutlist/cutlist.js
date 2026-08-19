// §5 Cut list, parts and sheets.

import { LAYERS, FACE_LABEL } from "../model/constants.js";
import { panelBlank, panelThickness, boxVolume } from "../model/solver.js";
import { panelBevels, panelEdgeNote } from "../model/bevel.js";

const LAYER_LABEL = { cladding: "Cladding", shell: "Carcass", doubler: "Doubler" };

/**
 * Sort by layer, then by area descending, and number after sorting so the
 * numbering is stable.
 */
export function buildCutList(sol, edges, owners, { material, grainLocked }) {
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
    .map((r, i) => ({
      id: `P${String(i + 1).padStart(2, "0")}`,
      face: r.panel.face,
      faceLabel: FACE_LABEL[r.panel.face],
      layer: r.panel.layer,
      layerLabel: LAYER_LABEL[r.panel.layer],
      length: r.blank.length,
      width: r.blank.width,
      thickness: r.thickness,
      area: r.area,
      material,
      grain: grainLocked ? "Locked, along length" : "Free",
      edgeWork: panelEdgeNote(r.bevels) || "—",
      panel: r.panel,
      panelIndex: r.index,
    }));

  return rows;
}

export function cutListTotals(rows, sheets, closure) {
  return {
    parts: rows.length,
    area: rows.reduce((a, r) => a + r.area, 0) / 1e6,
    sheets: sheets.length,
    closure: closure === 0 ? "exact" : closure.toExponential(3),
  };
}

const csvCell = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function cutListCsv(rows) {
  const head = ["Part", "Face", "Layer", "Length mm", "Width mm", "Thickness mm", "Material", "Grain", "Edge work"];
  const body = rows.map((r) => [r.id, r.faceLabel, r.layerLabel,
    fmt(r.length), fmt(r.width), fmt(r.thickness), r.material, r.grain, r.edgeWork]);
  return [head, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
}

export const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));

export const panelVolume = (p) => boxVolume(p.box);
