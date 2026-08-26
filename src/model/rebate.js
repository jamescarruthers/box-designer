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

import { FACES, AXIS, AXES, FACE_LABEL, LAYER_LABEL } from "./constants.js";
import { boxVolume } from "./solver.js";
import { mitredCells, polyArea } from "./mitre.js";

const EPS = 1e-9;

/** The sides of a panel on `face`: the four faces that meet it. */
export const rebateSides = (face) => FACES.filter((f) => AXIS[f][0] !== AXIS[face][0]);

/**
 * §46 The layers a rebate can be cut in: the boards, and not the lining.
 *
 * A rebate is a joint between two boards, and felt is not a board — a groove
 * in a lining is a dent, and a lining let into a groove is a lining folded
 * over. Everything else about the machinery is layer-blind, so a doubler is
 * rebated by the same rule a carcass panel is and into whatever happens to be
 * beside it, carcass or doubler or cladding.
 */
export const REBATABLE = ["cladding", "shell", "doubler"];

/** Which panel a rebate names. A bare face is the carcass, as it was in §42. */
export const rebateKey = (layer, face) => (layer === "shell" ? face : `${layer}|${face}`);

export function readRebateKey(key) {
  const parts = String(key).split("|");
  return parts.length > 1 && REBATABLE.includes(parts[0])
    ? { layer: parts[0], face: parts[1] }
    : { layer: "shell", face: parts[0] };
}

/** §46 What a rebated panel is called where a person reads it. */
export const rebateLabel = (layer, face) => (layer === "shell"
  ? FACE_LABEL[face] ?? face
  : `${FACE_LABEL[face] ?? face} ${(LAYER_LABEL[layer] ?? layer).toLowerCase()}`);

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
 *
 * §49 Anything building a *surface* wants `subtractCells` instead: merging
 * leaves neighbours meeting along part of a face rather than the whole of it,
 * and a face that is only partly shared cannot be cancelled against its
 * neighbour. The grid cells always meet a whole face at a time.
 */
export function subtractBoxes(box, notches) {
  return merge(subtractCells(box, notches));
}

/**
 * §49 The same subtraction, left as the grid it is worked out on.
 *
 * Every cell meets each of its neighbours across one whole face, which is what
 * lets a drawing cancel the faces that are inside the material: two identical
 * rectangles, back to back. `subtractBoxes` glues these together and is the
 * right answer for a volume or a rectangle to hatch; it is the wrong one for
 * anything that has to know which faces are on the outside.
 */
export function subtractCells(box, notches) {
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
  return kept;
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

/**
 * §44 What a panel is actually left with: its box, less the grooves, less the
 * mitres — reckoned together rather than one after the other.
 *
 * Apart they double-count. §12's `mitreLoss` takes off the whole 45° prism and
 * `panelVolume` takes off the whole groove, and where a groove runs into a
 * mitred corner the same material is in both. A panel mitred at two corners
 * and grooved for a rebated top came out 58 860 mm³ light on a box that size,
 * and the closure never noticed because both sides of the sum were computed
 * the same wrong way.
 *
 * So the groove cuts the box into cells, each cell is clipped by the mitres,
 * and the volume is what the cells add up to. One rule, applied to a shape
 * that has both.
 */
export function panelSolidVolume(panel) {
  const cells = subtractBoxes(panel.box, panel.notches);
  if (!(panel.mitres ?? []).length) return cells.reduce((a, b) => a + boxVolume(b), 0);
  return cells.reduce((a, cell) => {
    const pieces = mitredCells(panel, cell);
    if (!pieces) return a + boxVolume(cell);
    return a + pieces.reduce((b, piece) => b + polyArea(piece.poly) * piece.length, 0);
  }, 0);
}

/**
 * §43 The axis a mitre on this side of the panel runs along: the one that is
 * neither the panel's own thickness nor the side's.
 */
export const mitreRun = (panel, side) =>
  AXES.find((b) => b !== AXIS[panel.face][0] && b !== AXIS[side][0]);

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
export function applyRebates(panels, rebates) {
  // Deep enough to grow: the boxes are edited in place below, and the solve
  // they came from is nobody's to change.
  const out = panels.map((p) => ({
    ...p,
    box: Object.fromEntries(AXES.map((b) => [b, [...p.box[b]]])),
    notches: p.notches ? [...p.notches] : [],
  }));
  const applied = {}, rejected = new Map();

  // §46 Outermost first, so a rebate cut in the cladding is cut into the
  // cladding as it stands and a doubler's is cut into a carcass that has
  // already grown for its own. Layers settle from the outside in, and so do
  // the joints between them.
  const keys = Object.keys(rebates ?? {})
    .map((key) => ({ key, ...readRebateKey(key) }))
    .filter((k) => REBATABLE.includes(k.layer))
    .sort((a, b) => REBATABLE.indexOf(a.layer) - REBATABLE.indexOf(b.layer)
      || FACES.indexOf(a.face) - FACES.indexOf(b.face));

  for (const { key, layer, face } of keys) {
    const rebate = rebates[key];
    if (!rebate) continue;
    const depth = Number(rebate.depth);
    const panel = out.find((p) => p.face === face && p.layer === layer);
    if (!panel) { rejected.set(key, "there is no panel on that face to rebate"); continue; }
    if (!(depth > 0)) { rejected.set(key, "a rebate needs a depth"); continue; }

    const done = [];
    for (const side of rebateSides(face)) {
      if (!rebate.sides?.[side]) continue;
      // §12 A mitre and a rebate are two ways to make the same joint, and a
      // board cannot have both on one edge: the mitre runs the panel out to
      // the corner, which is the material the rebate wants to slide into.
      if ((panel.mitres ?? []).some((m) => m.side === side)) {
        rejected.set(`${key}|${side}`,
          `that joint is mitred, and a mitre and a rebate are two different joints — take the mitre off the edge to rebate into it`);
        continue;
      }
      // §43 And a rebate must not stretch a mitre the panel carries elsewhere.
      // Growing the panel along an axis makes every mitre that *runs* along
      // that axis longer — on this panel only, since the one it is mitred to
      // has not moved. Two halves of one joint, cut to different lengths.
      const grows = AXIS[side][0];
      const stretched = (panel.mitres ?? []).find((m) => mitreRun(panel, m.side) === grows);
      if (stretched) {
        rejected.set(`${key}|${side}`,
          `it would make the ${face}/${stretched.side} mitre longer than the panel it is mitred to`);
        continue;
      }
      const slab = rebateSlab(panel, side, depth);
      // §46 Only boards are rebated into. A lining in the way is not backing:
      // the tongue would land in felt, and the coverage test below refuses it
      // for exactly that reason rather than cutting a groove in the lagging.
      // The layers nest, so in a solved box what is beside a board at its own
      // depth is another board — this is the rule written down, not a case
      // anybody meets.
      const hits = out.filter((p) =>
        p !== panel && REBATABLE.includes(p.layer) && overlaps(p.box, slab));
      const why = `${key}|${side}`;
      // The reasons that are about the panel rather than about one of its
      // sides are worded that way on purpose: a rebate on four sides that all
      // fail for the same reason is one thing wrong, and the messages say it
      // once. The mitre is the exception, being a fact about one joint.
      if (!hits.length) {
        rejected.set(why,
          `the ${rebateLabel(layer, face)} panel already runs past the panels beside it, so there is nothing there to rebate into — move it down the prominence order to let it in`);
        continue;
      }
      // Deepest first, because "it goes right through the panel beside it" is
      // the reason, and the coverage test below would only report the symptom.
      const thinnest = Math.min(...hits.map((p) => p.box[AXIS[side][0]][1] - p.box[AXIS[side][0]][0]));
      if (depth >= thinnest - EPS) {
        rejected.set(why, `a ${fmt(depth)} mm rebate goes right through the ${fmt(thinnest)} mm panel beside it`);
        continue;
      }
      // §43 What is left of the slab once the panels around it are taken out
      // of it — the union, not the sum of the pieces. §12 mitred boxes overlap
      // each other in the corner prism until the 45° cut takes it off them,
      // and adding their shares up counts that corner twice, which reads as a
      // slab bigger than it is and refuses a rebate that is perfectly cuttable.
      const uncovered = subtractBoxes(slab, hits.map((p) => p.box))
        .reduce((a, c) => a + boxVolume(c), 0);
      if (uncovered > 1e-6 * Math.max(1, boxVolume(slab))) {
        rejected.set(why,
          `the ${rebateLabel(layer, face)} panel is not backed by board along the whole of that edge — part of the rebate would be cut into thin air`);
        continue;
      }

      // Nothing is refused after this point, so the panel can grow.
      const [axis, sign] = AXIS[side];
      if (sign < 0) panel.box[axis][0] -= depth; else panel.box[axis][1] += depth;
      // §44 Every panel the slab reaches takes its share of it, overlaps and
      // all. Two mitred boxes overlap in the corner prism, and the tongue that
      // lands there has to be let into both of them — each losing the half of
      // the corner the 45° cut left it, which is what `panelSolidVolume`
      // reckons. Handing the whole corner to the first of them instead cuts a
      // groove in a board where the mitre had already taken the material away.
      for (const p of hits) p.notches.push(intersect(p.box, slab));
      done.push(side);
    }
    if (done.length) applied[key] = { depth, sides: done, layer, face };
  }

  // Three sides of one rebate cut one groove down the panel beside them, not
  // three grooves that happen to touch.
  for (const p of out) if (p.notches.length > 1) p.notches = merge(p.notches);

  return { panels: out, applied, rejected };
}

/**
 * §43 The refusals, gathered by what they are: one entry per face and reason,
 * naming the sides it applies to.
 *
 * Reported this way because that is how it went wrong the first time. A rebate
 * asked for on four sides and cut on two said "let in on front and back" and
 * nothing whatever about the other two, so the only trace of the refusal was a
 * warning in a list of warnings — and the answer to "why did it only do front
 * and back" was on the screen and unfindable.
 */
export function rebateProblems(rejected) {
  const out = [];
  for (const [full, why] of rejected ?? []) {
    // §46 A key is the panel, optionally with the side it went wrong on, and
    // the panel is itself one part or two. Layers and faces are named from
    // disjoint lists, so the first part says which shape this is.
    const parts = String(full).split("|");
    const hasSide = parts.length === 3 || (parts.length === 2 && !REBATABLE.includes(parts[0]));
    const side = hasSide ? parts.pop() : null;
    const key = parts.join("|");
    const found = out.find((p) => p.key === key && p.why === why);
    if (found) { if (side) found.sides.push(side); continue; }
    out.push({ key, ...readRebateKey(key), why, sides: side ? [side] : [] });
  }
  return out;
}

/**
 * §42 What a rebate does to the panel it is cut into, for the cut list.
 *
 * The blank does not change — the groove is cut after the board is, out of the
 * middle of it — so the note is the whole story: how deep, how wide, and which
 * face of the board it is on.
 */
/**
 * §45 The grooves in a panel, in the coordinates its blank is drawn in.
 *
 * The same transform the fittings use — length axis across, width axis down,
 * flipped so a template laid on the board has its work in the right places —
 * except that a groove is a rectangle rather than a circle, and it carries how
 * deep it is, which is the whole of what makes it a rebate rather than a hole.
 */
export function blankNotches(panel, blank) {
  const a = AXIS[panel.face][0];
  const { lengthAxis, widthAxis } = blank;
  return (panel.notches ?? []).map((n) => {
    const x = [n[lengthAxis][0] - panel.box[lengthAxis][0], n[lengthAxis][1] - panel.box[lengthAxis][0]];
    const y = [panel.box[widthAxis][1] - n[widthAxis][1], panel.box[widthAxis][1] - n[widthAxis][0]];
    return {
      x: x[0], y: y[0], w: x[1] - x[0], h: y[1] - y[0],
      depth: n[a][1] - n[a][0],
    };
  });
}

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

/**
 * §45 The same thing in a table cell: how deep and how wide, without the word
 * "Rebate" in front of it, because the column is already called that.
 */
export function notchSpec(panel) {
  const note = notchNote(panel);
  return note ? note.replace(/^Rebate /, "") : "";
}

const fmt = (v) => String(Math.round(v * 100) / 100);
