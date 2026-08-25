// §42 Rebates: a panel let into the ones around it.
//
// A front panel sitting inside a mitred carcass can be rebated into it — the
// panel runs on past where it stopped, and a groove is cut in each panel it
// runs into to receive it. One board is longer and wider, the others have a
// notch in them, and no material appears or disappears in the process.
//
// That last part is the whole design. The panel grows by exactly the slab it
// now occupies, and every panel that slab lands in loses exactly its share of
// it, so §2.4's closure — envelope = panels + cavity — still comes out at zero.
// A rebate that could not be cut is one whose slab lands somewhere other than
// in another panel, and that is refused rather than fudged.

import { FACES, AXIS, AXES } from "./constants.js";
import { boxVolume } from "./solver.js";

const EPS = 1e-9;

/** The sides of a panel on `face`: the four faces that meet it. */
export const rebateSides = (face) => FACES.filter((f) => AXIS[f][0] !== AXIS[face][0]);

export const DEFAULT_REBATE_DEPTH = 6;

/** A new rebate: nothing chosen yet, at a depth somebody will change. */
export const newRebate = (depth = DEFAULT_REBATE_DEPTH) => ({ sides: {}, depth });

/** The sides a rebate actually asks for, in face order. */
export const rebatedSides = (panel, rebate) =>
  rebateSides(panel.face).filter((g) => rebate?.sides?.[g]);

/** Do two boxes overlap in more than a face? */
export const overlaps = (a, b) =>
  AXES.every((k) => Math.min(a[k][1], b[k][1]) - Math.max(a[k][0], b[k][0]) > EPS);

/** The box both of these cover, or null where they only touch. */
export function intersect(a, b) {
  const out = {};
  for (const k of AXES) {
    const lo = Math.max(a[k][0], b[k][0]), hi = Math.min(a[k][1], b[k][1]);
    if (hi - lo <= EPS) return null;
    out[k] = [lo, hi];
  }
  return out;
}

/**
 * §42 What a box is left as once some other boxes are taken out of it.
 *
 * Every cut plane of every notch, in each axis, divides the box into cells; a
 * cell survives if its middle is not inside a notch. Crude, and exactly right
 * — including where two notches overlap in a corner, which is the case that
 * makes subtracting them one at a time double-count the corner and lose the
 * closure. Adjacent survivors are merged back along the first axis, so the
 * common shape — a board with one groove in it — comes back as two boxes
 * rather than a wall of them.
 */
export function subtractBoxes(box, notches) {
  const inside = (notches ?? []).map((n) => intersect(box, n)).filter(Boolean);
  if (!inside.length) return [box];

  const cuts = {};
  for (const k of AXES) {
    const set = new Set([box[k][0], box[k][1]]);
    for (const n of inside) { set.add(n[k][0]); set.add(n[k][1]); }
    cuts[k] = [...set].sort((u, v) => u - v);
  }

  const kept = [];
  const [X, Y, Z] = AXES;
  for (let i = 0; i + 1 < cuts[X].length; i++) {
    for (let j = 0; j + 1 < cuts[Y].length; j++) {
      for (let k = 0; k + 1 < cuts[Z].length; k++) {
        const cell = {
          [X]: [cuts[X][i], cuts[X][i + 1]],
          [Y]: [cuts[Y][j], cuts[Y][j + 1]],
          [Z]: [cuts[Z][k], cuts[Z][k + 1]],
        };
        const mid = Object.fromEntries(AXES.map((b) => [b, (cell[b][0] + cell[b][1]) / 2]));
        if (inside.some((n) => AXES.every((b) => n[b][0] < mid[b] && mid[b] < n[b][1]))) continue;
        if (AXES.some((b) => cell[b][1] - cell[b][0] <= EPS)) continue;
        kept.push(cell);
      }
    }
  }
  return merge(kept);
}

/** Glue cells back together where they share a face, one axis at a time. */
function merge(cells) {
  let out = cells;
  for (const axis of AXES) {
    const others = AXES.filter((b) => b !== axis);
    const groups = new Map();
    for (const c of out) {
      const key = others.map((b) => `${c[b][0]}:${c[b][1]}`).join("|");
      (groups.get(key) ?? groups.set(key, []).get(key)).push(c);
    }
    const next = [];
    for (const group of groups.values()) {
      group.sort((a, b) => a[axis][0] - b[axis][0]);
      let run = null;
      for (const c of group) {
        if (run && Math.abs(run[axis][1] - c[axis][0]) <= EPS) run[axis][1] = c[axis][1];
        else { run = { ...c, [axis]: [...c[axis]] }; next.push(run); }
      }
    }
    out = next;
  }
  return out;
}

/** The solid volume of a panel: its box, less whatever has been cut out of it. */
export const panelVolume = (panel) =>
  subtractBoxes(panel.box, panel.notches).reduce((a, b) => a + boxVolume(b), 0);

/** The slab a panel takes on when it is rebated `depth` into the face `side`. */
export function rebateSlab(panel, side, depth) {
  const [axis, sign] = AXIS[side];
  const slab = Object.fromEntries(AXES.map((b) => [b, [...panel.box[b]]]));
  slab[axis] = sign < 0
    ? [panel.box[axis][0] - depth, panel.box[axis][0]]
    : [panel.box[axis][1], panel.box[axis][1] + depth];
  return slab;
}

/**
 * §42 Apply the rebates to a solved set of panels.
 *
 * Each rebate is checked before it is cut, and the check is the same one the
 * closure would have caught later: does the slab the panel is about to occupy
 * land wholly inside other panels? If any of it would land in the cavity or
 * outside the box, the panel was not inset on that side and there is nothing
 * there to rebate into — so the side is refused, with a reason, and nothing
 * moves. A rebate deeper than the thinnest panel it cuts is refused too: that
 * is not a groove, it is a hole.
 */
export function applyRebates(panels, rebates, layer = "shell") {
  // Deep enough to grow: the boxes are edited in place below, and the solve
  // they came from is nobody's to change.
  const out = panels.map((p) => ({
    ...p,
    box: Object.fromEntries(AXES.map((b) => [b, [...p.box[b]]])),
    notches: p.notches ? [...p.notches] : [],
  }));
  const applied = {}, rejected = new Map();

  for (const face of FACES) {
    const rebate = rebates?.[face];
    if (!rebate) continue;
    const depth = Number(rebate.depth);
    const panel = out.find((p) => p.face === face && p.layer === layer);
    if (!panel) { rejected.set(face, "there is no panel on that face to rebate"); continue; }
    if (!(depth > 0)) { rejected.set(face, "a rebate needs a depth"); continue; }

    const done = [];
    for (const side of rebateSides(face)) {
      if (!rebate.sides?.[side]) continue;
      // §12 A mitre and a rebate are two ways to make the same joint, and a
      // board cannot have both on one edge: the mitre runs the panel out to
      // the corner, which is the material the rebate wants to slide into.
      if ((panel.mitres ?? []).some((m) => m.side === side)) {
        rejected.set(`${face}|${side}`,
          `the ${face}/${side} joint is mitred, and a mitre and a rebate are two different joints`);
        continue;
      }
      const slab = rebateSlab(panel, side, depth);
      const hits = out.filter((p) => p !== panel && overlaps(p.box, slab));
      const why = `${face}|${side}`;
      // The reasons that are about the panel rather than about one of its
      // sides are worded that way on purpose: a rebate on four sides that all
      // fail for the same reason is one thing wrong, and the messages say it
      // once. The mitre is the exception, being a fact about one joint.
      if (!hits.length) {
        rejected.set(why,
          `the ${face} panel already runs past the panels beside it, so there is nothing there to rebate into — move it down the prominence order to let it in`);
        continue;
      }
      // Deepest first, because "it goes right through the panel beside it" is
      // the reason, and the coverage test below would only report the symptom.
      const thinnest = Math.min(...hits.map((p) => p.box[AXIS[side][0]][1] - p.box[AXIS[side][0]][0]));
      if (depth >= thinnest - EPS) {
        rejected.set(why, `a ${fmt(depth)} mm rebate goes right through the ${fmt(thinnest)} mm panel beside it`);
        continue;
      }
      const covered = hits.reduce((a, p) => a + boxVolume(intersect(p.box, slab)), 0);
      const want = boxVolume(slab);
      if (Math.abs(covered - want) > 1e-6 * Math.max(1, want)) {
        rejected.set(why,
          `the ${face} panel is not backed by board along the whole of that edge — part of the rebate would be cut into thin air`);
        continue;
      }

      // Nothing is refused after this point, so the panel can grow.
      const [axis, sign] = AXIS[side];
      if (sign < 0) panel.box[axis][0] -= depth; else panel.box[axis][1] += depth;
      for (const p of hits) p.notches.push(intersect(p.box, slab));
      done.push(side);
    }
    if (done.length) applied[face] = { depth, sides: done };
  }

  // Three sides of one rebate cut one groove down the panel beside them, not
  // three grooves that happen to touch.
  for (const p of out) if (p.notches.length > 1) p.notches = merge(p.notches);

  return { panels: out, applied, rejected };
}

/**
 * §42 What a rebate does to the panel it is cut into, for the cut list.
 *
 * The blank does not change — the groove is cut after the board is, out of the
 * middle of it — so the note is the whole story: how deep, how wide, and which
 * face of the board it is on.
 */
export function notchNote(panel) {
  if (!panel.notches?.length) return "";
  const a = AXIS[panel.face][0];
  const planar = AXES.filter((b) => b !== a);
  const parts = panel.notches.map((n) => {
    const deep = n[a][1] - n[a][0];
    // A groove is long and narrow: the narrow way across is the width the
    // cutter is set to, and the long way is where it runs.
    const spans = planar.map((b) => ({ b, cut: n[b][1] - n[b][0] })).sort((u, v) => u.cut - v.cut);
    const run = spans[1];
    const through = run.cut >= panel.box[run.b][1] - panel.box[run.b][0] - EPS;
    return `${fmt(deep)} × ${fmt(spans[0].cut)}${through ? "" : " stopped"}`;
  });
  return `Rebate ${parts.join(", ")}`;
}

const fmt = (v) => String(Math.round(v * 100) / 100);
