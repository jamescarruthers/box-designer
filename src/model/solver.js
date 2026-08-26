// §2 The core model. One rule, applied three times.

import { FACES, AXIS, PAIR, AXES, LAYERS, rankFromOrder } from "./constants.js";

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

/**
 * wall[f] = cladding[f] + thickness[f] + doubler[f] + lagging[f]
 *
 * §30 Lagging is in the wall for the same reason a doubler is: it stands
 * between the outside of the box and the air inside it. A box asked for twelve
 * litres of cavity and then lined with ten millimetres of felt has to grow to
 * still hold twelve, and the wall is where that is reckoned.
 */
export function wallOf(cladding, thickness, doubler, lagging = {}) {
  return Object.fromEntries(FACES.map((f) =>
    [f, (cladding[f] || 0) + (thickness[f] || 0) + (doubler[f] || 0) + (lagging[f] || 0)]));
}

/**
 * §30 The board in a wall: everything but the lining.
 *
 * A bevel is cut into the outside of the box and §26's rule is that it has to
 * leave material behind it. Felt is not that material. Counting the lining in
 * would let a 20 mm fillet be cut on an 18 mm carcass because there was 10 mm
 * of wadding glued behind it — which is not a rounded corner, it is a hole in
 * the box with something soft showing through.
 */
export function boardOf(cladding, thickness, doubler) {
  return Object.fromEntries(FACES.map((f) =>
    [f, (cladding[f] || 0) + (thickness[f] || 0) + (doubler[f] || 0)]));
}

/** skin[f] = cladding[f] || thickness[f] — the outermost sheet at that face. */
export function skinOf(cladding, thickness) {
  return Object.fromEntries(FACES.map((f) => [f, cladding[f] || thickness[f] || 0]));
}

export const DEFAULT_RATIO = { x: 1, y: 1.25, z: 1.6 };

/**
 * §16 The sizes a person can be asked to cut to.
 *
 * Rounding happens **once**, on the envelope, and everything else is derived
 * from the rounded figure — so the panels still tile it exactly and the volume
 * still closes. Rounding the panels instead would put the error between them,
 * which is the one place a box cannot take it.
 */
export const ROUND_STEPS = [0.1, 0.5, 1, 5, 10];
export const DEFAULT_ROUND = 1;

/**
 * To the nearest `step`, and no further. `Math.round(v / 0.1) * 0.1` is
 * 236.40000000000003, which is a longer number than the one it set out to
 * shorten.
 */
export const snapTo = (v, step) => {
  if (!(step > 0)) return v;
  // The quotient is settled before it is rounded. 0.35 / 0.1 is
  // 3.4999999999999996, so the honest answer to "nearest tenth" would be 0.3 —
  // right about the double, wrong about the millimetre that was meant by it.
  const steps = Math.round(Number((v / step).toFixed(9)));
  return Number((steps * step).toFixed(4));
};

/**
 * §2.3 Derive the envelope from the starting point.
 * basis: "internal" | "external"; mode: "dimensions" | "volume".
 *
 * `round` is the step to snap the envelope to, in mm — the older `true`/`false`
 * still mean 0.1 mm and not at all.
 */
export function deriveEnvelope({ basis, mode, size, litres, ratio = DEFAULT_RATIO }, wall, round = 0.1) {
  let s;
  if (mode === "volume") {
    const k = Math.cbrt((litres * 1e6) / (ratio.x * ratio.y * ratio.z));
    s = { x: ratio.x * k, y: ratio.y * k, z: ratio.z * k };
  } else {
    s = { x: size.x, y: size.y, z: size.z };
  }
  const internal = basis === "internal";
  const step = round === true ? 0.1 : round === false ? 0 : Number(round) || 0;
  const E = {};
  for (const b of AXES) {
    const [bm, bp] = PAIR[b];
    const v = internal ? s[b] + wall[bm] + wall[bp] : s[b];
    E[b] = snapTo(v, step);
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
 * Solve the whole box. Returns envelope, the four layers' panels, the cavity
 * and the volume-closure residual (§2.4 invariant 2).
 */
export function solve(input) {
  const cladding = fillFaces(input.cladding);
  const thickness = fillFaces(input.thickness);
  const doubler = fillFaces(input.doubler);
  const lagging = fillFaces(input.lagging);
  const rank = input.rank ?? rankFromOrder(input.order ?? FACES);
  // §53 Prominence is a property of a layer, not only of the box. Each layer
  // tiles the cavity the one outside it left, and which of its panels runs past
  // which is a question asked afresh at that depth: a doubler ring stiffening a
  // baffle wants its own answer, and the carcass around it is not affected by
  // the answer either way. Unstated, a layer follows the box — which is what
  // every design before this one meant.
  const ranks = Object.fromEntries(LAYERS.map((l) => [l, input.ranks?.[l] ?? rank]));
  const wall = wallOf(cladding, thickness, doubler, lagging);
  const board = boardOf(cladding, thickness, doubler);

  const E = input.envelope ?? deriveEnvelope(input.start, wall,
    input.round === undefined ? 0.1 : input.round);
  const env = envelopeBox(E);

  const L0 = shellLayer(env, cladding, ranks.cladding, "cladding");
  const L1 = shellLayer(L0.inner, thickness, ranks.shell, "shell");
  const L2 = shellLayer(L1.inner, doubler, ranks.doubler, "doubler");
  // §30 One rule, applied four times now. The lining is the innermost of them,
  // so the cavity is the air inside the lagging rather than inside the boards.
  const L3 = shellLayer(L2.inner, lagging, ranks.lagging, "lagging");

  const panels = [...L0.parts, ...L1.parts, ...L2.parts, ...L3.parts];
  const cavity = L3.inner;

  const envVolume = boxVolume(env);
  const closure = envVolume - (panels.reduce((a, p) => a + boxVolume(p.box), 0) + boxVolume(cavity));

  return {
    E, env, rank, ranks, wall, board, cladding, thickness, doubler, lagging,
    panels, cavity, envVolume,
    carcassInner: L1.inner,          // inside the shell, before doublers
    boardInner: L2.inner,            // §30 inside the boards, before the lining
    // §37 Every box the wall encloses, outermost first, each named by the
    // layer it is inside of. The drawing dimensions them all: a doubled,
    // lined box has four interiors and only the last of them was on the sheet.
    interiors: [
      { layer: "cladding", box: L0.inner },
      { layer: "shell", box: L1.inner },
      { layer: "doubler", box: L2.inner },
      { layer: "lagging", box: L3.inner },
    ],
    internal: boxSize(cavity),
    closure,
    // The invariant is exact in arithmetic; in doubles it is exact to rounding.
    closureExact: Math.abs(closure) <= 1e-9 * envVolume,
  };
}

export function boxesOverlap(a, b) {
  return AXES.every((k) => Math.min(a[k][1], b[k][1]) - Math.max(a[k][0], b[k][0]) > 0);
}
