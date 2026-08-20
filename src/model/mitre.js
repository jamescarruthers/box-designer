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

/** A panel spans the envelope along `ax` when it reaches both bounds. */
export const spansRun = (panel, ax, env) =>
  Math.abs(panel.box[ax][0] - env[ax][0]) < EPS && Math.abs(panel.box[ax][1] - env[ax][1]) < EPS;

/**
 * Whether an edge can take a mitre, and if not, why.
 *
 * Three conditions, all of them things a maker would say out loud:
 *
 * 1. Both faces carry a panel in the same layer — you cannot mitre to nothing.
 * 2. Both panels run the edge's full length. Otherwise a third panel is in the
 *    way partway along and the cut cannot run through.
 * 3. Both are the same thickness, so the cut is 45° and the two halves meet.
 *    Unequal thicknesses have a mitre at some other angle, but it stops being a
 *    saw set to 45 and starts being a calculation per joint.
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
  for (const [p, f] of [[p1, f1], [p2, f2]]) {
    if (!spansRun(p, ax, env)) {
      return { ok: false, why: `the ${FACE_LABEL[f].toLowerCase()} panel does not run the whole edge` };
    }
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
 * Apply the requested mitres to a panel list.
 *
 * Every edge is judged against the box as it arrived, before any of them move.
 * Mitring one edge grows a panel, which could make a second edge mitrable that
 * was not — and then the answer would depend on which edge was asked for
 * first, and on nothing a maker would recognise.
 *
 * Only the panel that was butting grows — the one that wrapped is already out
 * at the corner. Getting that wrong double-counts the corner prism and the
 * volume stops closing, which is exactly how the first attempt failed.
 */
export function applyMitres(panels, env, requested, layer = "shell") {
  const checks = mitrableEdges(panels, env, layer);
  const out = panels.map((p) => ({ ...p, box: { ...p.box }, mitres: [...(p.mitres ?? [])] }));
  const applied = [];

  for (const key of EDGES) {
    if (!requested?.[key]) continue;
    const check = checks[key];
    if (!check.ok) continue;

    const [f1, f2] = key.split("|");
    for (const [self, other] of [[f1, f2], [f2, f1]]) {
      const p = out.find((q) => q.face === self && q.layer === layer);
      const [oa, os] = AXIS[other];
      // Grow to the envelope on the other panel's side. Already there = no-op.
      if (os < 0) p.box[oa] = [env[oa][0], p.box[oa][1]];
      else p.box[oa] = [p.box[oa][0], env[oa][1]];
      p.mitres.push({ side: other, edge: key, leg: check.thickness });
    }
    applied.push(key);
  }
  return { panels: out, applied };
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
export function mitreIssues(mitrable, requested) {
  const msgs = [];
  for (const key of EDGES) {
    if (!requested?.[key]) continue;
    const check = mitrable[key];
    if (!check.ok) {
      const [f1, f2] = key.split("|");
      msgs.push({ level: "warning", key,
        text: `No mitre on ${FACE_LABEL[f1].toLowerCase()}/${FACE_LABEL[f2].toLowerCase()}: ${check.why}. Left as a butt joint.` });
    }
  }
  return msgs;
}
