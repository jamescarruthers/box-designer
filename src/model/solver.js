// §2 The core model. One rule, applied three times.

import { FACES, AXIS, PAIR, AXES, rankFromOrder } from "./constants.js";

/** Tile the walls of `box` with panels of thickness `th`, ordered by `rank`. */
export function shellLayer(box, th, rank, name) {
  const parts = [], inner = {};
  for (const b of AXES) {
    const [bm, bp] = PAIR[b];
    inner[b] = [box[b][0] + (th[bm] || 0), box[b][1] - (th[bp] || 0)];
  }
  for (const f of FACES) {
    if (!(th[f] > 0)) continue;              // omit the panel, keep the trimming
    const [a, s] = AXIS[f];
    const nb = {};
    nb[a] = s < 0 ? [box[a][0], box[a][0] + th[f]]
                  : [box[a][1] - th[f], box[a][1]];
    for (const b of AXES) {
      if (b === a) continue;
      const [bm, bp] = PAIR[b];
      nb[b] = [rank[f] < rank[bm] ? box[b][0] : box[b][0] + (th[bm] || 0),
               rank[f] < rank[bp] ? box[b][1] : box[b][1] - (th[bp] || 0)];
    }
    parts.push({ face: f, layer: name, box: nb });
  }
  return { parts, inner };
}

export const zeroFaces = (v = 0) => Object.fromEntries(FACES.map((f) => [f, v]));

export function fillFaces(value) {
  if (typeof value === "number") return zeroFaces(value);
  return Object.fromEntries(FACES.map((f) => [f, value?.[f] ?? 0]));
}

/** wall[f] = cladding[f] + thickness[f] + doubler[f] */
export function wallOf(cladding, thickness, doubler) {
  return Object.fromEntries(FACES.map((f) =>
    [f, (cladding[f] || 0) + (thickness[f] || 0) + (doubler[f] || 0)]));
}

/** skin[f] = cladding[f] || thickness[f] — the outermost sheet at that face. */
export function skinOf(cladding, thickness) {
  return Object.fromEntries(FACES.map((f) => [f, cladding[f] || thickness[f] || 0]));
}

export const DEFAULT_RATIO = { x: 1, y: 1.25, z: 1.6 };

const round01 = (v) => Math.round(v * 10) / 10;

/**
 * §2.3 Derive the envelope from the starting point.
 * basis: "internal" | "external"; mode: "dimensions" | "volume".
 */
export function deriveEnvelope({ basis, mode, size, litres, ratio = DEFAULT_RATIO }, wall, round = true) {
  let s;
  if (mode === "volume") {
    const k = Math.cbrt((litres * 1e6) / (ratio.x * ratio.y * ratio.z));
    s = { x: ratio.x * k, y: ratio.y * k, z: ratio.z * k };
  } else {
    s = { x: size.x, y: size.y, z: size.z };
  }
  const internal = basis === "internal";
  const E = {};
  for (const b of AXES) {
    const [bm, bp] = PAIR[b];
    const v = internal ? s[b] + wall[bm] + wall[bp] : s[b];
    E[b] = round ? round01(v) : v;
  }
  return E;
}

export const envelopeBox = (E) => ({ x: [0, E.x], y: [0, E.y], z: [0, E.z] });

export const boxSize = (b) => ({ x: b.x[1] - b.x[0], y: b.y[1] - b.y[0], z: b.z[1] - b.z[0] });

export const boxVolume = (b) => {
  const s = boxSize(b);
  return s.x * s.y * s.z;
};

/** The two planar axes of a panel on face `f`, and its thickness axis. */
export function panelAxes(face) {
  const a = AXIS[face][0];
  return { thick: a, planar: AXES.filter((b) => b !== a) };
}

/** Panel blank size: [length, width] with length the larger. */
export function panelBlank(panel) {
  const { planar } = panelAxes(panel.face);
  const d = planar.map((b) => panel.box[b][1] - panel.box[b][0]);
  const [p, q] = planar;
  return d[0] >= d[1]
    ? { length: d[0], width: d[1], lengthAxis: p, widthAxis: q }
    : { length: d[1], width: d[0], lengthAxis: q, widthAxis: p };
}

export function panelThickness(panel) {
  const a = AXIS[panel.face][0];
  return panel.box[a][1] - panel.box[a][0];
}

/**
 * Solve the whole box. Returns envelope, the three layers' panels, the cavity
 * and the volume-closure residual (§2.4 invariant 2).
 */
export function solve(input) {
  const cladding = fillFaces(input.cladding);
  const thickness = fillFaces(input.thickness);
  const doubler = fillFaces(input.doubler);
  const rank = input.rank ?? rankFromOrder(input.order ?? FACES);
  const wall = wallOf(cladding, thickness, doubler);

  const E = input.envelope ?? deriveEnvelope(input.start, wall, input.round !== false);
  const env = envelopeBox(E);

  const L0 = shellLayer(env, cladding, rank, "cladding");
  const L1 = shellLayer(L0.inner, thickness, rank, "shell");
  const L2 = shellLayer(L1.inner, doubler, rank, "doubler");

  const panels = [...L0.parts, ...L1.parts, ...L2.parts];
  const cavity = L2.inner;

  const closure = boxVolume(env) - (panels.reduce((a, p) => a + boxVolume(p.box), 0) + boxVolume(cavity));

  return {
    E, env, rank, wall, cladding, thickness, doubler,
    panels, cavity,
    carcassInner: L1.inner,          // inside the shell, before doublers
    internal: boxSize(cavity),
    closure,
  };
}

export function boxesOverlap(a, b) {
  return AXES.every((k) => Math.min(a[k][1], b[k][1]) - Math.max(a[k][0], b[k][0]) > 0);
}
