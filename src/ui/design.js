// The design state, and everything derived from it.

import { FACES, MATERIALS, PROMINENCE_PRESETS, DEFAULT_KERF, rankFromOrder, materialById } from "../model/constants.js";
import { solve, wallOf, fillFaces, skinOf, DEFAULT_RATIO } from "../model/solver.js";
import { uniformEdges, edgeOwners, noEdges } from "../model/bevel.js";
import { validate } from "../model/validate.js";
import { buildCutList, cutListTotals } from "../cutlist/cutlist.js";
import { nest } from "../cutlist/nest.js";
import { buildSheet } from "../drawing/sheet.js";

export const DEFAULT_MATERIAL = "birch";

export const DEFAULT_DESIGN = {
  title: "SHEET BOX",
  start: {
    basis: "internal",
    mode: "volume",
    size: { x: 300, y: 375, z: 480 },
    litres: 12,
    ratio: { ...DEFAULT_RATIO },
  },
  material: DEFAULT_MATERIAL,
  stockIndex: 0,
  grainLocked: false,
  kerf: DEFAULT_KERF,
  thickness: materialById(DEFAULT_MATERIAL).thickness,
  perFaceThickness: false,
  thicknessBy: Object.fromEntries(FACES.map((f) => [f, materialById(DEFAULT_MATERIAL).thickness])),
  order: PROMINENCE_PRESETS[0].order,
  preset: PROMINENCE_PRESETS[0].id,
  // Cladding and doublers are added a side at a time. Each entry carries its own
  // material and thickness, inherited from the project sheet and then editable.
  cladding: {},
  doubler: {},
  edge: { type: "none", radius: 12, perEdge: false, by: {} },
  sectionAt: null,
};

export const LAYER_KEY = { cladding: "cladding", doubler: "doubler" };

/** A new cladding or doubler panel inherits the project's sheet. */
export function inheritedPanel(design) {
  return { material: design.material, thickness: design.thickness };
}

/** The faces a layer has no panel on yet. */
export const freeFaces = (design, layer) => FACES.filter((f) => !design[layer]?.[f]);

export function addPanel(design, layer, face) {
  return { ...design, [layer]: { ...design[layer], [face]: inheritedPanel(design) } };
}

export function removePanel(design, layer, face) {
  const next = { ...design[layer] };
  delete next[face];
  return { ...design, [layer]: next };
}

/**
 * Switching the project sheet moves the carcass to that material's standard
 * thickness, unless the current thickness was a deliberate departure from the
 * old material's standard.
 */
export function setProjectMaterial(design, id) {
  const next = { ...design, material: id, stockIndex: 0 };
  if (design.thickness === materialById(design.material).thickness) {
    next.thickness = materialById(id).thickness;
    next.thicknessBy = Object.fromEntries(FACES.map((f) =>
      [f, design.thicknessBy[f] === design.thickness ? next.thickness : design.thicknessBy[f]]));
  }
  return next;
}

export function setProjectThickness(design, thickness) {
  return {
    ...design,
    thickness,
    thicknessBy: Object.fromEntries(FACES.map((f) => [f, thickness])),
  };
}

export function editPanel(design, layer, face, patch) {
  const cur = design[layer][face];
  if (!cur) return design;
  const next = { ...cur, ...patch };
  // Changing the material moves the panel to that material's standard thickness,
  // unless the thickness is being set in the same edit.
  if (patch.material && patch.thickness === undefined && cur.thickness === materialById(cur.material).thickness) {
    next.thickness = materialById(patch.material).thickness;
  }
  return { ...design, [layer]: { ...design[layer], [face]: next } };
}

/** Thickness per face for the solver, which knows nothing about materials. */
export const layerThickness = (entries) =>
  fillFaces(Object.fromEntries(Object.entries(entries ?? {}).map(([f, e]) => [f, e.thickness || 0])));

export function edgeMap(design) {
  if (!design.edge.perEdge) {
    return design.edge.type === "none" ? noEdges() : uniformEdges(design.edge.type, design.edge.radius);
  }
  const base = noEdges();
  for (const [k, v] of Object.entries(design.edge.by)) base[k] = v;
  return base;
}

export function thicknessMap(design) {
  return design.perFaceThickness ? { ...design.thicknessBy } : fillFaces(design.thickness);
}

/** The sheet a given panel is cut from. Shell panels use the project material. */
export function panelSpec(design, panel) {
  if (panel.layer === "shell") {
    return { material: design.material, thickness: thicknessMap(design)[panel.face] };
  }
  return design[panel.layer]?.[panel.face] ?? inheritedPanel(design);
}

/** Stock size for a material: the project's choice for the project sheet, else the first. */
export function stockFor(design, materialId) {
  const m = materialById(materialId);
  return materialId === design.material
    ? m.stock[Math.min(design.stockIndex, m.stock.length - 1)]
    : m.stock[0];
}

/** Solve the box and everything downstream of it. */
export function derive(design) {
  const thickness = thicknessMap(design);
  const cladding = layerThickness(design.cladding);
  const doubler = layerThickness(design.doubler);
  const rank = rankFromOrder(design.order);
  const wall = wallOf(cladding, thickness, doubler);

  const sol = solve({ start: design.start, thickness, cladding, doubler, rank });
  sol.skin = skinOf(cladding, thickness);
  sol.wall = wall;

  const edges = edgeMap(design);
  const owners = edgeOwners(sol.env, sol.panels);
  const material = materialById(design.material);

  const specFor = (panel) => {
    const spec = panelSpec(design, panel);
    const m = materialById(spec.material);
    return { materialId: m.id, material: m.name, colour: m.colour, grained: m.grained };
  };

  const rows = buildCutList(sol, edges, owners, { specFor, grainLocked: design.grainLocked });
  const sheets = nest(rows, {
    stockFor: (id) => stockFor(design, id),
    kerf: design.kerf,
    grainLocked: design.grainLocked,
  });
  const totals = cutListTotals(rows, sheets, sol.closure, sol.closureExact);
  const messages = validate(sol, edges);
  const sectionAt = design.sectionAt ?? sol.E.x / 2;

  // The title block names the carcass; anything else appears in the cut list.
  const others = [...new Set(rows.filter((r) => r.materialId !== material.id).map((r) => r.materialId))];
  const materialNote = `${material.name.toUpperCase()} ${design.thickness}` +
    (others.length ? ` +${others.length}` : "");

  const sheet = buildSheet(sol, edges, { title: design.title, material: materialNote, sectionAt });

  return { sol, edges, owners, material, rows, sheets, totals, messages, sheet, sectionAt, specFor };
}

export const setIn = (obj, path, value) => {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...obj, [head]: value };
  return { ...obj, [head]: setIn(obj[head] ?? {}, rest, value) };
};
