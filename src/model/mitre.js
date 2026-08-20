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

/** Grow the butting panel of each mitre out to the envelope corner. */
function growFor(panels, env, keys, layer) {
  const out = panels.map((p) => ({ ...p, box: { ...p.box }, mitres: [...(p.mitres ?? [])] }));
  for (const key of keys) {
    const [f1, f2] = key.split("|");
    for (const [self, other] of [[f1, f2], [f2, f1]]) {
      const p = out.find((q) => q.face === self && q.layer === layer);
      const [oa, os] = AXIS[other];
      // Out to the envelope on the other panel's side. Already there = no-op.
      if (os < 0) p.box[oa] = [env[oa][0], p.box[oa][1]];
      else p.box[oa] = [p.box[oa][0], env[oa][1]];
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
