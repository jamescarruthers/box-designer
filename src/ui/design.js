// The design state, and everything derived from it.

import { FACES, MATERIALS, PROMINENCE_PRESETS, DEFAULT_KERF, rankFromOrder } from "../model/constants.js";
import { solve, wallOf, fillFaces, skinOf, DEFAULT_RATIO } from "../model/solver.js";
import { uniformEdges, edgeOwners, noEdges } from "../model/bevel.js";
import { validate } from "../model/validate.js";
import { buildCutList, cutListTotals } from "../cutlist/cutlist.js";
import { nest } from "../cutlist/nest.js";
import { buildSheet } from "../drawing/sheet.js";

export const DEFAULT_DESIGN = {
  title: "SHEET BOX",
  start: {
    basis: "internal",
    mode: "volume",
    size: { x: 300, y: 375, z: 480 },
    litres: 12,
    ratio: { ...DEFAULT_RATIO },
  },
  material: "birch",
  stockIndex: 0,
  grainLocked: false,
  kerf: DEFAULT_KERF,
  thickness: 18,
  perFaceThickness: false,
  thicknessBy: Object.fromEntries(FACES.map((f) => [f, 18])),
  order: PROMINENCE_PRESETS[0].order,
  preset: PROMINENCE_PRESETS[0].id,
  cladding: Object.fromEntries(FACES.map((f) => [f, 0])),
  doubler: Object.fromEntries(FACES.map((f) => [f, 0])),
  edge: { type: "none", radius: 12, perEdge: false, by: {} },
  sectionAt: null,
};

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

/** Solve the box and everything downstream of it. */
export function derive(design) {
  const thickness = thicknessMap(design);
  const cladding = fillFaces(design.cladding);
  const doubler = fillFaces(design.doubler);
  const rank = rankFromOrder(design.order);
  const wall = wallOf(cladding, thickness, doubler);

  const sol = solve({ start: design.start, thickness, cladding, doubler, rank });
  sol.skin = skinOf(cladding, thickness);
  sol.wall = wall;

  const edges = edgeMap(design);
  const owners = edgeOwners(sol.env, sol.panels);
  const material = MATERIALS.find((m) => m.id === design.material) ?? MATERIALS[0];
  const stock = material.stock[Math.min(design.stockIndex, material.stock.length - 1)];

  const rows = buildCutList(sol, edges, owners, {
    material: material.name,
    grainLocked: design.grainLocked && material.grained,
  });
  const sheets = nest(rows, { stock, kerf: design.kerf, grainLocked: design.grainLocked && material.grained });
  const totals = cutListTotals(rows, sheets, sol.closure, sol.closureExact);
  const messages = validate(sol, edges);
  const sectionAt = design.sectionAt ?? sol.E.x / 2;

  const sheet = buildSheet(sol, edges, {
    title: design.title,
    material: `${material.name.toUpperCase()} ${design.thickness}`,
    sectionAt,
  });

  return { sol, edges, owners, material, stock, rows, sheets, totals, messages, sheet, sectionAt };
}

export const setIn = (obj, path, value) => {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...obj, [head]: value };
  return { ...obj, [head]: setIn(obj[head] ?? {}, rest, value) };
};
