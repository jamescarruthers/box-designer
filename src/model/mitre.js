// §12 Mitred edges.
//
// A butt joint shows one panel's edge grain on the other's face; a mitre brings
// both out to the corner and cuts each back 45°, so no end grain shows and the
// outer surface runs unbroken round the corner. §10 recorded its absence.
//
// The whole thing reduces to one observation: **a mitre is a chamfer whose leg
// is the panel's own thickness.** Grow the panel that was butting out to the
// envelope corner, chamfer both panels by their thickness on that side, and the
// existing bevel machinery — ring stacks in the 3D view, corner and tangent
// lines in the drawing, BRepFilletAPI_MakeChamfer in the kernel — draws it.

import { AXIS, AXES, EDGES, FACE_LABEL, edgeAxis } from "./constants.js";

const EPS = 1e-9;

export const panelThicknessOn = (panel) => {
  const a = AXIS[panel.face][0];
  return panel.box[a][1] - panel.box[a][0];
};

/** Two panels coincide along `ax` when they start and end together. */
export const runsTogether = (p1, p2, ax) =>
  Math.abs(p1.box[ax][0] - p2.box[ax][0]) < EPS && Math.abs(p1.box[ax][1] - p2.box[ax][1]) < EPS;

/**
 * Whether an edge can take a mitre, and if not, why.
 *
 * Three conditions, all of them things a maker would say out loud:
 *
 * 1. Both faces carry a panel in the same layer — you cannot mitre to nothing.
 * 2. The two panels meet along the whole edge: they start and end together.
 *    If one runs past the other, its 45° cut would come out into open air at
 *    that end, against the side of whatever panel is there.
 * 3. Both are the same thickness, so the cut is 45° and the two halves meet.
 *    Unequal thicknesses have a mitre at some other angle, but it stops being a
 *    saw set to 45 and starts being a calculation per joint.
 *
 * Note what (2) does *not* ask: that the joint reach the envelope. Under the
 * standard prominence the front and back wrap and the other four panels form a
 * tube between them, whose four long corners run from the front panel to the
 * back one. Those coincide exactly and mitre perfectly well, butting at each
 * end — a whole class of real joints the envelope test used to refuse.
 */
export function mitreCheck(panels, env, key, layer = "shell") {
  const [f1, f2] = key.split("|");
  const ax = edgeAxis(key);
  const p1 = panels.find((p) => p.face === f1 && p.layer === layer);
  const p2 = panels.find((p) => p.face === f2 && p.layer === layer);

  if (!p1 || !p2) {
    const missing = !p1 ? f1 : f2;
    return { ok: false, why: `there is no ${layer} panel on the ${FACE_LABEL[missing].toLowerCase()}` };
  }
  if (!runsTogether(p1, p2, ax)) {
    const longer = (p1.box[ax][1] - p1.box[ax][0]) > (p2.box[ax][1] - p2.box[ax][0]) ? f1 : f2;
    return { ok: false,
      why: `the ${FACE_LABEL[longer].toLowerCase()} panel runs past the other, so the cut would come out in mid-air` };
  }
  const t1 = panelThicknessOn(p1), t2 = panelThicknessOn(p2);
  if (Math.abs(t1 - t2) > EPS) {
    return { ok: false, why: `the panels are ${t1} and ${t2} mm — a mitre needs them equal` };
  }
  return { ok: true, thickness: t1, panels: [p1, p2], run: ax };
}

/** Every edge, with whether it can be mitred. */
export function mitrableEdges(panels, env, layer = "shell") {
  return Object.fromEntries(EDGES.map((k) => [k, mitreCheck(panels, env, k, layer)]));
}

/**
 * Grow the butting panel of each mitre out to the corner it shares.
 *
 * The corner is the **other panel's outer face**, not the envelope. Those are
 * the same thing on a bare carcass, which is why the envelope stood in for it —
 * until cladding went on. Cladding sits outside the shell, so the envelope is
 * 6 mm further out than the shell's own corner, and growing to it drove the
 * mitred panel straight through the cladding: closure went out by exactly the
 * overlap, and §2.4 called it a bug, correctly.
 */
function growFor(panels, env, keys, layer) {
  const out = panels.map((p) => ({ ...p, box: { ...p.box }, mitres: [...(p.mitres ?? [])] }));
  const on = (face) => out.find((q) => q.face === face && q.layer === layer);
  for (const key of keys) {
    const [f1, f2] = key.split("|");
    // Both targets read before either moves: growing the first would otherwise
    // move the corner the second is aiming at.
    const corner = Object.fromEntries([f1, f2].map((f) => {
      const [a, s] = AXIS[f];
      return [f, s < 0 ? on(f).box[a][0] : on(f).box[a][1]];
    }));
    for (const [self, other] of [[f1, f2], [f2, f1]]) {
      const p = on(self);
      const [oa, os] = AXIS[other];
      // Out to the other panel's outer face. Already there = no-op.
      if (os < 0) p.box[oa] = [corner[other], p.box[oa][1]];
      else p.box[oa] = [p.box[oa][0], corner[other]];
    }
  }
  return out;
}

/**
 * Which of the requested mitres can actually be cut, given the others.
 *
 * Mitres interact, and it took a broken volume to notice. Mitring front/left
 * grows the left panel forward to the envelope; that lengthens it along y,
 * which is the axis the left/top joint runs along — so the left panel now runs
 * past the top panel and their mitre would have to stop partway down it. The
 * geometry cannot express a cut that stops, §3 refuses one for the same reason,
 * and the arithmetic quietly over-counted the wedge.
 *
 * The shape of it: **a panel takes mitres on opposite sides, not adjacent
 * ones** — unless every neighbour grows to match, which a strict prominence
 * order never arranges. That is the classic mitred box: one ring of four
 * corners, with the remaining two panels let in.
 *
 * Taken greedily in edge order so the answer never depends on the order the
 * user clicked, and so a pair that rules each other out leaves one standing
 * rather than neither.
 */
export function resolveMitres(panels, env, requested, layer = "shell") {
  const accepted = [];
  const rejected = new Map();

  for (const key of EDGES) {
    if (!requested?.[key]) continue;
    const check = mitreCheck(panels, env, key, layer);
    if (!check.ok) { rejected.set(key, check.why); continue; }

    const trial = [...accepted, key];
    const grown = growFor(panels, env, trial, layer);
    const broken = trial.find((k) => !mitreCheck(grown, env, k, layer).ok);
    if (!broken) { accepted.push(key); continue; }

    const culprit = broken === key ? accepted.find((k) => sharesPanel(k, key)) : broken;
    rejected.set(key, culprit
      ? `the ${culprit.replace("|", "/")} mitre grows a panel past this joint — a panel takes mitres on opposite sides, not adjacent ones`
      : "the panels no longer meet along the whole edge once the other mitres are cut");
  }
  return { accepted, rejected, panels: growFor(panels, env, accepted, layer) };
}

const sharesPanel = (a, b) => a.split("|").some((f) => b.split("|").includes(f));

/**
 * Apply the requested mitres to a panel list.
 *
 * Only the panel that was butting grows — the one that wrapped is already out
 * at the corner. Getting that wrong double-counts the corner prism and the
 * volume stops closing, which is exactly how the first attempt failed.
 */
export function applyMitres(panels, env, requested, layer = "shell") {
  const { accepted, rejected, panels: out } = resolveMitres(panels, env, requested, layer);
  for (const key of accepted) {
    const [f1, f2] = key.split("|");
    const leg = panelThicknessOn(out.find((q) => q.face === f1 && q.layer === layer));
    for (const [self, other] of [[f1, f2], [f2, f1]]) {
      out.find((q) => q.face === self && q.layer === layer)
        .mitres.push({ side: other, edge: key, leg });
    }
  }
  return { panels: out, applied: accepted, rejected };
}

/** The material a 45° cut takes off one side of a panel: a triangular prism. */
export function mitreLoss(panel) {
  return (panel.mitres ?? []).reduce((a, m) => {
    const run = AXES.find((b) => b !== AXIS[panel.face][0] && b !== AXIS[m.side][0]);
    return a + (m.leg * m.leg / 2) * (panel.box[run][1] - panel.box[run][0]);
  }, 0);
}

/**
 * Mitres as bevels, so everything downstream draws them without knowing.
 * Keyed by the panel's own side face, the shape `panelBevels` returns. The leg
 * is the panel's thickness, so the cut reaches the inner face exactly.
 */
export function mitreBevels(panel) {
  return Object.fromEntries((panel.mitres ?? []).map((m) =>
    [m.side, { type: "mitre", radius: m.leg }]));
}

/** §8 Tell the user which requested mitres could not be cut, and why. */
export function mitreIssues(rejected) {
  return [...rejected].map(([key, why]) => {
    const [f1, f2] = key.split("|");
    return { level: "warning", key,
      text: `No mitre on ${FACE_LABEL[f1].toLowerCase()}/${FACE_LABEL[f2].toLowerCase()}: ${why}. Left as a butt joint.` };
  });
}

/**
 * §44 A panel's mitres as half-planes, in the two axes they live in.
 *
 * A mitre cuts at 45° through the panel's thickness: at depth `d` from the
 * outer face it has eaten `min(d, leg)` off that side. So it is a plane in the
 * side axis against the thickness axis, and it does nothing at all to the
 * third — which is why a solid can be clipped by one and stay a prism.
 *
 * §12 keeps a panel's mitres on opposite sides, never adjacent ones, so they
 * all share a single side axis and one 2D plane holds the lot.
 */
export function mitrePlanes(panel) {
  const cuts = panel.mitres ?? [];
  if (!cuts.length) return null;
  const [thick, sign] = AXIS[panel.face];
  const axis = AXIS[cuts[0].side][0];
  if (cuts.some((m) => AXIS[m.side][0] !== axis)) return null;   // never, but not assumed
  const outer = sign < 0 ? panel.box[thick][0] : panel.box[thick][1];
  return {
    thick, axis, outer, sign,
    run: AXES.find((b) => b !== thick && b !== axis),
    cuts: cuts.map((m) => ({ side: m.side, leg: m.leg, low: AXIS[m.side][1] < 0 })),
  };
}

/** Clip a convex polygon to `keep(point) >= 0`, cutting the edges that cross. */
function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= -EPS) out.push(a);
    if ((fa > EPS && fb < -EPS) || (fa < -EPS && fb > EPS)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/**
 * §44 What is left of one box of a panel once its mitres have been cut.
 *
 * Returned as cross-sections in [side axis, thickness axis] with a length to
 * extrude each along — because that is exactly what they are. A box with no
 * mitres on it comes back as null, so the caller can keep its own box.
 *
 * More than one piece only where a mitre's leg stops short of the far face:
 * the cut is 45° down to the leg and flat from there on, and the region above
 * a boundary that bends is not convex. Split at the bend and each half is.
 * §12 cuts every mitre with a leg equal to the thickness, so in practice the
 * bend is at the far face and there is one piece — but the general shape is
 * cheap enough to get right, and a leg that stops short is a thing to draw.
 */
export function mitredCells(panel, cell) {
  const m = mitrePlanes(panel);
  if (!m) return null;
  const { thick, axis, outer, sign, run, cuts } = m;

  // Depths at which a cut stops biting, as coordinates on the thickness axis.
  const bends = new Set([cell[thick][0], cell[thick][1]]);
  for (const c of cuts) {
    const at = sign < 0 ? outer + c.leg : outer - c.leg;
    if (at > cell[thick][0] + EPS && at < cell[thick][1] - EPS) bends.add(at);
  }
  const cuts0 = [...bends].sort((a, b) => a - b);

  const out = [];
  for (let i = 0; i + 1 < cuts0.length; i++) {
    const v = [cuts0[i], cuts0[i + 1]];
    const u = cell[axis];
    let poly = [[u[0], v[0]], [u[1], v[0]], [u[1], v[1]], [u[0], v[1]]];
    const mid = sign < 0 ? (v[0] + v[1]) / 2 - outer : outer - (v[0] + v[1]) / 2;
    for (const c of cuts) {
      const edge = c.low ? panel.box[axis][0] : panel.box[axis][1];
      // One rule per piece: the sloping face while the cut is still biting,
      // the flat it runs out to once it is not.
      const inset = mid <= c.leg
        ? (p) => (sign < 0 ? p[1] - outer : outer - p[1])
        : () => c.leg;
      poly = clipHalf(poly, c.low
        ? (p) => p[0] - (edge + inset(p))
        : (p) => (edge - inset(p)) - p[0]);
      if (poly.length < 3) { poly = []; break; }
    }
    if (poly.length >= 3) out.push({ axis, thick, run, poly, at: cell[run], length: cell[run][1] - cell[run][0] });
  }
  return out;
}

/** The area of a convex polygon, by the shoelace. */
export const polyArea = (poly) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};
