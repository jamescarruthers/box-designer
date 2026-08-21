// The design state, and everything derived from it.

import { EDGES, FACES, MATERIALS, PROMINENCE_PRESETS, DEFAULT_KERF, rankFromOrder, materialById, paletteFor } from "../model/constants.js";
import { solve, wallOf, fillFaces, skinOf, boxVolume, DEFAULT_RATIO, DEFAULT_ROUND } from "../model/solver.js";
import { uniformEdges, edgeOwners, noEdges, fullLengthEdges, applicableEdges, partialEdgeIssues } from "../model/bevel.js";
import { mitreCheck, resolveMitres, applyMitres, mitreIssues, mitreLoss } from "../model/mitre.js";
import { validate } from "../model/validate.js";
import { fittingOwners, innermostOn, fittingIssues, fittingNote, hasTube, resolveFittings } from "../model/fittings.js";
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
  // §16 What the sizes are rounded to. A tenth of a millimetre is a number
  // nobody can cut to and everybody has to read.
  round: DEFAULT_ROUND,
  material: DEFAULT_MATERIAL,
  // §18 The sheet's colour. Null means the colour it comes in — birch ply is
  // the colour birch ply is, and a design that has not said otherwise should
  // not be carrying a hex code that happens to equal the default.
  colour: null,
  perPanelColour: false,
  colourBy: {},
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
  // §10's biggest gap: the holes that make a box a speaker.
  fittings: [],
  sectionAt: null,
};

export const LAYER_KEY = { cladding: "cladding", doubler: "doubler" };

/** A new cladding or doubler panel inherits the project's sheet, colour and all. */
export function inheritedPanel(design) {
  const panel = { material: design.material, thickness: design.thickness };
  if (design.colour) panel.colour = design.colour;
  return panel;
}

/**
 * §18 What colour a shell panel is.
 *
 * Per face when that is switched on and the face has been given one, then the
 * project's colour, then the colour the sheet comes in. Each step is a fallback
 * rather than a copy, so changing the sheet moves every panel that was only
 * following it and leaves the ones that were not.
 */
export function shellColour(design, face) {
  if (design.perPanelColour && design.colourBy?.[face]) return design.colourBy[face];
  return design.colour ?? materialById(design.material).colour;
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
  // §18 A colour belongs to a range. Valchromat's Green Mint is not a thing you
  // can order in birch ply, so changing the sheet drops the colours with it
  // rather than carrying a number across that no longer means anything.
  if (id !== design.material) {
    next.colour = null;
    next.colourBy = {};
  }
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
  // §18 As above: the colour went with the old sheet unless it is being set here.
  if (patch.material && patch.colour === undefined) delete next.colour;
  return { ...design, [layer]: { ...design[layer], [face]: next } };
}

/** Thickness per face for the solver, which knows nothing about materials. */
export const layerThickness = (entries) =>
  fillFaces(Object.fromEntries(Object.entries(entries ?? {}).map(([f, e]) => [f, e.thickness || 0])));

/**
 * The decorative treatments only. A mitre is a joint rather than a decoration,
 * and the two are mutually exclusive on one edge: the mitre already cuts that
 * corner at 45°, and a fillet on top of it would have to be split across two
 * panels that each own half the corner.
 */
export function edgeMap(design) {
  if (!design.edge.perEdge) {
    return design.edge.type === "none" ? noEdges() : uniformEdges(design.edge.type, design.edge.radius);
  }
  const base = noEdges();
  for (const [k, v] of Object.entries(design.edge.by)) {
    base[k] = v.type === "mitre" ? { type: "none", radius: 0 } : v;
  }
  return base;
}

/**
 * §15 Set one edge's treatment, from a click in the 3D view.
 *
 * Switching to per-edge mode seeds `by` from whatever the uniform setting was,
 * so the click changes the edge it was aimed at and nothing else. Coming from a
 * box with a 12 mm fillet all round, clicking one edge square must leave the
 * other eleven filleted — not reset the lot because the mode changed.
 *
 * "none" removes the entry rather than storing a square one: the list is meant
 * to be what has been done to the box, and a row saying "square" is a row
 * saying nothing.
 */
export function setEdgeTreatment(design, key, type, radius) {
  const seed = design.edge.perEdge
    ? design.edge.by
    : Object.fromEntries(EDGES
      .filter(() => design.edge.type !== "none")
      .map((k) => [k, { type: design.edge.type, radius: design.edge.radius }]));

  const by = { ...seed };
  if (type === "none") delete by[key];
  else by[key] = { type, radius: radius ?? by[key]?.radius ?? design.edge.radius };

  return { ...design, edge: { ...design.edge, perEdge: true, by } };
}

/** §15 The edges that have actually been given a treatment. */
export function treatedEdges(design) {
  if (!design.edge.perEdge) {
    return design.edge.type === "none" ? [] : EDGES.map((k) => [k, { type: design.edge.type, radius: design.edge.radius }]);
  }
  return EDGES.filter((k) => design.edge.by[k] && design.edge.by[k].type !== "none")
    .map((k) => [k, design.edge.by[k]]);
}

/** Which edges the design asks to mitre. */
export function mitreMap(design) {
  if (!design.edge.perEdge) return {};
  return Object.fromEntries(
    Object.entries(design.edge.by).filter(([, v]) => v.type === "mitre").map(([k]) => [k, true]));
}

/**
 * Cut the accepted mitres into `sol`, and re-derive closure from the result.
 *
 * Recomputed, not adjusted: a mitre both grows a box and cuts material off it,
 * so the old residual is no longer a term in the new sum. The cavity is
 * untouched — a mitre moves material between two panels and nowhere else.
 */
function applyMitresInto(sol, requested) {
  if (!Object.keys(requested).length) return { applied: [], rejected: new Map() };
  const { panels, applied, rejected } = applyMitres(sol.panels, sol.env, requested);
  sol.panels = panels;
  sol.mitreLoss = panels.reduce((a, p) => a + mitreLoss(p), 0);
  const solid = panels.reduce((a, p) => a + boxVolume(p.box), 0) - sol.mitreLoss;
  sol.closure = sol.envVolume - (solid + boxVolume(sol.cavity));
  sol.closureExact = Math.abs(sol.closure) <= 1e-9 * sol.envVolume;
  return { applied, rejected };
}

export function thicknessMap(design) {
  return design.perFaceThickness ? { ...design.thicknessBy } : fillFaces(design.thickness);
}

/** The sheet a given panel is cut from. Shell panels use the project material. */
export function panelSpec(design, panel) {
  if (panel.layer === "shell") {
    return {
      material: design.material,
      thickness: thicknessMap(design)[panel.face],
      colour: shellColour(design, panel.face),
    };
  }
  const entry = design[panel.layer]?.[panel.face] ?? inheritedPanel(design);
  return { ...entry, colour: entry.colour ?? materialById(entry.material).colour };
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

  const sol = solve({ start: design.start, thickness, cladding, doubler, rank, round: design.round });

  // §12 Mitres redistribute material between two panels: the one that butted
  // grows out to the corner and both are cut back 45°. Applied before anything
  // measures a panel, so the cut list and the views see the mitred sizes.
  const requestedMitres = mitreMap(design);
  const plain = sol.panels;
  const { applied, rejected } = applyMitresInto(sol, requestedMitres);

  // What the control may still offer. Mitres interact — one can grow a panel
  // past a joint another needs — so this is judged against what is already
  // chosen, not against the bare box. An edge already mitred stays on.
  const mitrable = Object.fromEntries(EDGES.map((key) => {
    const base = mitreCheck(plain, sol.env, key);
    if (!base.ok) return [key, base];
    if (applied.includes(key)) return [key, { ok: true }];
    // Offered only if it is additive. Resolution is greedy in edge order, so an
    // edge early in that order can displace one already chosen — and an option
    // that silently undoes four of the user's mitres is not an option.
    const trial = resolveMitres(plain, sol.env, { ...requestedMitres, [key]: true });
    const displaced = applied.filter((k) => !trial.accepted.includes(k));
    if (displaced.length) {
      return [key, { ok: false,
        why: `it would undo the ${displaced[0].replace("|", "/")} mitre — a panel takes mitres on opposite sides, not adjacent ones` }];
    }
    return [key, trial.accepted.includes(key)
      ? { ok: true }
      : { ok: false, why: trial.rejected.get(key) }];
  }));
  sol.skin = skinOf(cladding, thickness);
  sol.wall = wall;

  // A bevel can only be cut along an edge one panel runs the whole length of.
  const requestedEdges = edgeMap(design);
  const owners = edgeOwners(sol.env, sol.panels);
  const fullLength = fullLengthEdges(sol.env, sol.panels, owners);
  const edges = applicableEdges(requestedEdges, fullLength);
  const material = materialById(design.material);

  const specFor = (panel) => {
    const spec = panelSpec(design, panel);
    const m = materialById(spec.material);
    // §18 The panel's colour if it has been given one, the sheet's otherwise.
    return { materialId: m.id, material: m.name, colour: spec.colour ?? m.colour, grained: m.grained };
  };

  // §10 A hole goes all the way: every panel on the face is cut, cladding and
  // doubler included. `fittingPanels` is still the outermost of them, because
  // that is the face a driver bolts to and the surface positions are set out on.
  const authored = design.fittings ?? [];
  const faces = [...new Set(authored.map((f) => f.face))];
  const fittingPanels = fittingOwners(sol.panels, faces);
  // §20 A position can be written as a proportion of the panel it is on.
  // Resolved here, once, so nothing downstream has to know that.
  const fittings = resolveFittings(authored, fittingPanels);
  const fittingsOn = (panel) => fittings.filter((f) => f.face === panel.face);
  // A port's tube hangs off the innermost layer, once, however many it bored.
  const tubePanels = Object.fromEntries(faces.map((f) => [f, innermostOn(sol.panels, f)]));
  const tubesOn = (panel) =>
    fittings.filter((f) => hasTube(f) && tubePanels[f.face] === panel);

  const rows = buildCutList(sol, edges, owners, { specFor, grainLocked: design.grainLocked })
    .map((r) => {
      const on = fittingsOn(r.panel);
      return on.length ? { ...r, fittings: on, fittingNote: fittingNote(on) } : { ...r, fittings: [], fittingNote: "" };
    });
  const sheets = nest(rows, {
    stockFor: (id) => stockFor(design, id),
    kerf: design.kerf,
    grainLocked: design.grainLocked,
  });
  const totals = cutListTotals(rows, sheets, sol.closure, sol.closureExact);
  const messages = [
    ...validate(sol, edges),
    ...partialEdgeIssues(requestedEdges, fullLength),
    ...mitreIssues(rejected),
    ...fittingIssues(fittings, sol.panels, fittingPanels, sol.cavity),
  ];
  const sectionAt = design.sectionAt ?? sol.E.x / 2;

  // The title block names the carcass; anything else appears in the cut list.
  const others = [...new Set(rows.filter((r) => r.materialId !== material.id).map((r) => r.materialId))];
  const materialNote = `${material.name.toUpperCase()} ${design.thickness}` +
    (others.length ? ` +${others.length}` : "");

  const sheet = buildSheet(sol, edges, {
    title: design.title, material: materialNote, sectionAt,
    fittings, fittingPanels,
  });

  // The largest consistent set, for the "mitre all" shortcut: asking for every
  // mitrable edge at once and warning about the half that conflict is no use.
  const mitreRing = resolveMitres(plain, sol.env,
    Object.fromEntries(EDGES.filter((k) => mitreCheck(plain, sol.env, k).ok).map((k) => [k, true]))).accepted;

  return { sol, edges, requestedEdges, fullLength, mitrable, requestedMitres, mitreRing, owners, material, rows, sheets, totals, messages,
    sheet, sectionAt, specFor, fittings, fittingPanels, fittingsOn, tubesOn };
}

export const setIn = (obj, path, value) => {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...obj, [head]: value };
  return { ...obj, [head]: setIn(obj[head] ?? {}, rest, value) };
};
