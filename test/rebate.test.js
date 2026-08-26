import { describe, it, expect } from "vitest";
import { solve, boxVolume } from "../src/model/solver.js";
import { applyMitres, mitreLoss, mitredCells, polyArea } from "../src/model/mitre.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";
import { noEdges } from "../src/model/bevel.js";
import {
  applyRebates, subtractBoxes, panelVolume, rebateSlab, rebateSides, notchNote, intersect, newRebate,
  rebateProblems, mitreRun, panelSolidVolume, blankNotches, notchSpec,
  rebateKey, readRebateKey, rebateLabel, REBATABLE,
} from "../src/model/rebate.js";
import { panelPositions, notchDepth } from "../src/three/panelGeometry.js";
import { panelBlank } from "../src/model/solver.js";
import { cutListCsv } from "../src/cutlist/cutlist.js";
import { ACCENT, REBATE } from "../src/three/palette.js";
import { DEFAULT_DESIGN, derive, addPanel } from "../src/ui/design.js";

const box = (x, y, z) => ({ x, y, z });
/** A box that is inset on every side of its front panel: something to let it in to. */
const letIn = (extra = {}) => solve({
  envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
  order: ["left", "right", "top", "bottom", "front", "back"], ...extra,
});
const all = (depth = 6) => ({ depth, sides: { left: true, right: true, top: true, bottom: true } });

describe("§42 taking boxes out of a box", () => {
  it("gives the box back when nothing is taken out", () => {
    const b = box([0, 10], [0, 10], [0, 10]);
    expect(subtractBoxes(b, [])).toEqual([b]);
    expect(subtractBoxes(b, null)).toEqual([b]);
    // A notch that only touches it is not a notch.
    expect(subtractBoxes(b, [box([10, 12], [0, 10], [0, 10])])).toEqual([b]);
  });

  it("leaves exactly the volume it should", () => {
    const b = box([0, 10], [0, 10], [0, 10]);
    const groove = box([8, 10], [0, 4], [0, 10]);
    const left = subtractBoxes(b, [groove]);
    expect(left.reduce((a, c) => a + boxVolume(c), 0)).toBeCloseTo(1000 - 80, 9);
    // And the pieces are disjoint: no cell is inside another.
    for (const c of left) for (const d of left) if (c !== d) expect(intersect(c, d)).toBe(null);
  });

  it("counts a corner where two grooves overlap once, not twice", () => {
    const b = box([0, 10], [0, 10], [0, 10]);
    const a = box([8, 10], [0, 4], [0, 10]);
    const c = box([8, 10], [0, 10], [0, 4]);       // shares the 2×4×4 corner
    const left = subtractBoxes(b, [a, c]).reduce((s, p) => s + boxVolume(p), 0);
    expect(left).toBeCloseTo(1000 - (80 + 80 - 32), 9);
    // Subtracting them one at a time is what gets that wrong.
    expect(left).not.toBeCloseTo(1000 - 160, 6);
  });

  it("glues the pieces back together where it can", () => {
    // One groove down one edge leaves an L, which is two boxes and not nine.
    const b = box([0, 10], [0, 10], [0, 10]);
    expect(subtractBoxes(b, [box([8, 10], [0, 4], [0, 10])])).toHaveLength(2);
  });
});

describe("§42 letting a panel in", () => {
  const sol = letIn();
  const front = () => sol.panels.find((p) => p.face === "front" && p.layer === "shell");

  it("grows the panel and notches what it runs into", () => {
    const before = { ...front().box };
    const { panels, applied } = applyRebates(sol.panels, { front: all(6) });
    const after = panels.find((p) => p.face === "front" && p.layer === "shell");
    expect(applied.front.sides).toEqual(["left", "right", "top", "bottom"]);
    expect(after.box.x[0]).toBeCloseTo(before.x[0] - 6, 9);
    expect(after.box.x[1]).toBeCloseTo(before.x[1] + 6, 9);
    expect(after.box.z[0]).toBeCloseTo(before.z[0] - 6, 9);
    // Its own thickness is untouched: a rebate is not a thicker board.
    expect(after.box.y).toEqual(before.y);

    // One groove per panel it runs into, in that panel's inner face.
    for (const face of ["left", "right", "top", "bottom"]) {
      const p = panels.find((q) => q.face === face && q.layer === "shell");
      expect(p.notches).toHaveLength(1);
      expect(notchDepth(p)).toBeCloseTo(6, 9);
    }
    // And nothing at all on the back, which it never reached.
    expect(panels.find((p) => p.face === "back").notches).toHaveLength(0);
  });

  it("keeps the closure exact: no board appears or disappears", () => {
    const { panels } = applyRebates(sol.panels, { front: all(6) });
    const solid = panels.reduce((a, p) => a + panelVolume(p), 0);
    expect(boxVolume(sol.env) - (solid + boxVolume(sol.cavity))).toBeCloseTo(0, 6);
    // What the panel gained is what the others lost, to the cubic millimetre.
    const gained = panels.reduce((a, p) => a + boxVolume(p.box), 0)
      - sol.panels.reduce((a, p) => a + boxVolume(p.box), 0);
    const lost = panels.reduce((a, p) => a + boxVolume(p.box) - panelVolume(p), 0);
    expect(gained).toBeCloseTo(lost, 6);
  });

  it("makes one groove of three sides that meet", () => {
    // Left, top and bottom all cut into the left panel, and they touch: that
    // is one groove down the board, not three that happen to abut.
    const { panels } = applyRebates(sol.panels, { front: all(6) });
    const left = panels.find((p) => p.face === "left" && p.layer === "shell");
    expect(left.notches).toHaveLength(1);
    expect(notchNote(left)).toMatch(/^Rebate 6 × 18/);
  });

  it("refuses what cannot be cut, and says why", () => {
    // The front panel of a front-and-back-wrap box already runs past the sides.
    const wrap = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
      order: PROMINENCE_PRESETS[0].order });
    const nothing = applyRebates(wrap.panels, { front: all(6) });
    expect(Object.keys(nothing.applied)).toHaveLength(0);
    expect([...nothing.rejected.values()][0]).toMatch(/already runs past/);
    // Nothing moved, either.
    expect(nothing.panels.find((p) => p.face === "front").box)
      .toEqual(wrap.panels.find((p) => p.face === "front").box);

    // Deeper than the board it is cut into is a hole, not a groove.
    const deep = applyRebates(sol.panels, { front: { depth: 18, sides: { left: true } } });
    expect([...deep.rejected.values()][0]).toMatch(/right through the 18 mm panel/);

    // And a depth of nothing is not a rebate.
    expect([...applyRebates(sol.panels, { front: { depth: 0, sides: { left: true } } })
      .rejected.values()][0]).toMatch(/needs a depth/);
  });

  it("§12 will not rebate an edge that is already mitred", () => {
    // front|top is the one this box will mitre — the sides wrap, so the left
    // and right joints have nothing to cut against.
    const mitred = applyMitres(sol.panels, sol.env, { "front|top": true });
    expect(mitred.applied).toEqual(["front|top"]);
    const { applied, rejected } = applyRebates(mitred.panels, { front: all(6) });
    expect(rejected.get("front|top")).toMatch(/mitred/);
    // §43 And not on a side that would stretch it either: the front|top mitre
    // runs across the panel, so letting the panel in at the left or the right
    // makes that mitre longer on this panel and on no other.
    expect(rejected.get("front|left")).toMatch(/longer than the panel it is mitred to/);
    expect(rejected.get("front|right")).toMatch(/longer than the panel it is mitred to/);
    // The bottom grows the panel the other way, and the mitre does not care.
    expect(applied.front.sides).toEqual(["bottom"]);
  });

  it("offers the four sides that meet the panel, and no others", () => {
    expect(rebateSides("front")).toEqual(["left", "right", "top", "bottom"]);
    expect(rebateSides("top")).toEqual(["front", "back", "left", "right"]);
    expect(rebateSides("left")).toEqual(["front", "back", "top", "bottom"]);
    expect(newRebate().sides).toEqual({});
  });

  it("takes the slab from the side it is asked for", () => {
    const p = { face: "front", box: box([18, 218], [0, 18], [18, 338]) };
    expect(rebateSlab(p, "left", 6).x).toEqual([12, 18]);
    expect(rebateSlab(p, "right", 6).x).toEqual([218, 224]);
    expect(rebateSlab(p, "top", 6).z).toEqual([338, 344]);
    // Only the one axis moves.
    expect(rebateSlab(p, "left", 6).y).toEqual([0, 18]);
  });
});

describe("§42 the grooved panel as a solid", () => {
  const sol = letIn();
  const { panels } = applyRebates(sol.panels, { front: all(6) });

  const meshVolume = (pos) => {
    let v = 0;
    for (let i = 0; i < pos.length; i += 9) {
      const a = [pos[i], pos[i + 1], pos[i + 2]];
      const b = [pos[i + 3], pos[i + 4], pos[i + 5]];
      const c = [pos[i + 6], pos[i + 7], pos[i + 8]];
      v += (a[0] * (b[1] * c[2] - b[2] * c[1])
        - a[1] * (b[0] * c[2] - b[2] * c[0])
        + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
    return v;
  };

  it("encloses exactly the volume the model says it has", () => {
    // The signed volume of the triangles is the test that matters for a shape
    // that is not convex: a face left facing the wrong way takes its own
    // volume off the total twice over.
    for (const panel of panels) {
      const { positions } = panelPositions(panel, {}, sol.E);
      expect(meshVolume(positions)).toBeCloseTo(panelVolume(panel), 6);
    }
  });

  it("costs triangles only where there is a groove", () => {
    const plain = panelPositions(sol.panels.find((p) => p.face === "back"), {}, sol.E);
    const grooved = panelPositions(panels.find((p) => p.face === "left"), {}, sol.E);
    expect(plain.triangles).toBe(12);
    expect(grooved.triangles).toBeGreaterThan(12);
    expect(grooved.triangles).toBeLessThan(120);
    expect(notchDepth(sol.panels.find((p) => p.face === "back"))).toBe(null);
  });
});

describe("§42 through the design", () => {
  const design = (rebate) => ({
    ...DEFAULT_DESIGN, preset: "sides", order: PROMINENCE_PRESETS[1].order, rebate,
  });

  it("keeps the box the size it was and the closure exact", () => {
    const plain = derive(design({}));
    const cut = derive(design({ front: all(6) }));
    expect(cut.sol.E).toEqual(plain.sol.E);
    expect(cut.sol.closureExact).toBe(true);
    expect(cut.totals.closure).toBe("exact");
    expect(cut.rebated.front.sides).toHaveLength(4);
  });

  it("cuts a bigger board and notes the groove in the others", () => {
    const plain = derive(design({}));
    const cut = derive(design({ front: all(6) }));
    const row = (d, face) => d.rows.find((r) => r.panel.face === face && r.panel.layer === "shell");
    // The board that is let in gets bigger by twice the depth each way.
    expect(row(cut, "front").length).toBeCloseTo(row(plain, "front").length + 12, 6);
    expect(row(cut, "front").width).toBeCloseTo(row(plain, "front").width + 12, 6);
    // The ones it goes into are cut from the same blank as before, and carry
    // a note instead: the groove is machined out of the middle of the board.
    expect(row(cut, "left").length).toBe(row(plain, "left").length);
    expect(row(cut, "left").rebateNote).toMatch(/^Rebate 6 × 18/);
    expect(row(cut, "back").rebateNote).toBeUndefined();
  });

  it("warns once when a rebate cannot be cut, rather than four times", () => {
    const wrap = derive({ ...DEFAULT_DESIGN, rebate: { front: all(6) } });
    const warnings = wrap.messages.filter((m) => /^Rebate:/.test(m.text));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toMatch(/prominence order/);
    expect(wrap.rebated.front).toBeUndefined();
  });

  it("draws the groove, and draws no line through the middle of a board", () => {
    const cut = derive(design({ front: all(6) }));
    const { section, front } = cut.sheet.geometry;
    // The section hatches what is left of each board, so the two pieces of a
    // grooved one are hatched apart.
    const top = section.hatches.filter((h) => h.panel.face === "top");
    expect(top.length).toBeGreaterThan(1);
    // The elevation gains lines — the groove is behind the baffle, so they are
    // hidden detail — and none of them lies inside a single board.
    const plain = derive(design({}));
    expect(front.lines.length).toBeGreaterThan(plain.sheet.geometry.front.lines.length);
    expect(front.lines.some((l) => !l.visible)).toBe(true);
  });
});

describe("§43 rebating into a mitred box", () => {
  const mitred = (keys) => ({
    type: "none", radius: 12, perEdge: true,
    by: Object.fromEntries(keys.map((k) => [k, { type: "mitre", radius: 18 }])),
  });
  const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
  const design = (keys, rebate) => ({ ...DEFAULT_DESIGN, edge: mitred(keys), rebate });
  const allSides = { depth: 6, sides: Object.fromEntries(
    ["front", "back", "left", "right", "top", "bottom"].map((s) => [s, true])) };

  it("lets a top panel into a box whose corners are mitred, on all four sides", () => {
    // The bug: the panels of a mitred corner overlap each other in the corner
    // prism until the 45° cut takes it off them, and adding up their shares of
    // the slab counted that corner twice — which read as a slab bigger than it
    // is, and refused the two sides that reached into a mitre.
    const plain = derive(design([], { top: allSides }));
    const cut = derive(design(VERTICALS, { top: allSides }));
    expect(plain.rebated.top.sides).toEqual(["front", "back", "left", "right"]);
    expect(cut.rebated.top.sides).toEqual(["front", "back", "left", "right"]);
    expect(cut.rebateRejected.size).toBe(0);
  });

  it("keeps the closure exact where the tongue reaches a mitred corner", () => {
    // §44 The corner belongs to both boards, split by the 45° cut, so the
    // tongue that lands there is let into both — each losing the half it
    // actually has. Handing the whole corner to one of them cuts a groove
    // where the mitre had already taken the material away.
    for (const keys of [[], VERTICALS, ["left|top", "left|bottom"]]) {
      for (const face of ["front", "back", "left", "right", "top", "bottom"]) {
        const d = derive(design(keys, { [face]: allSides }));
        expect(d.sol.closureExact, `${face} with ${keys.length} mitres`).toBe(true);
        expect(d.totals.closure).toBe("exact");
      }
    }
  });

  it("will not stretch a mitre the panel carries somewhere else", () => {
    // A top mitred to the sides cannot be let in front or back: growing it
    // that way runs its left and right mitres on past the panels they are
    // mitred to, and one half of a joint longer than the other is not a joint.
    const d = derive(design(["left|top", "right|top"], { top: allSides }));
    expect(d.rebated.top).toBeUndefined();
    const problems = rebateProblems(d.rebateRejected);
    expect(problems.find((p) => p.why.includes("longer")).sides).toEqual(["front", "back"]);
    expect(problems.find((p) => p.why.includes("two different joints")).sides).toEqual(["left", "right"]);
  });

  it("says which sides it refused, even when it cut the others", () => {
    // What made this hard to see: the sidebar said "let in on front and back"
    // and nothing at all about the two it had not done.
    // The sides have to wrap for the front to be let in at all, and front|top
    // is the joint that box will mitre.
    const d = derive({ ...design(["front|top"], { front: allSides }),
      preset: "sides", order: PROMINENCE_PRESETS[1].order });
    expect(d.rebated.front.sides).toEqual(["bottom"]);
    const problems = rebateProblems(d.rebateRejected);
    expect(problems.flatMap((p) => p.sides).sort()).toEqual(["left", "right", "top"]);
    // One message per reason, naming the face and the sides it applies to.
    const warnings = d.messages.filter((m) => /^Rebate:/.test(m.text));
    expect(warnings).toHaveLength(problems.length);
    for (const w of warnings) expect(w.text).toMatch(/^Rebate: Front \(/);
  });

  it("groups the refusals by reason, not one per side", () => {
    const rejected = new Map([
      ["top|left", "a"], ["top|right", "a"], ["top|front", "b"], ["back", "c"],
    ]);
    expect(rebateProblems(rejected)).toEqual([
      { key: "top", layer: "shell", face: "top", why: "a", sides: ["left", "right"] },
      { key: "top", layer: "shell", face: "top", why: "b", sides: ["front"] },
      { key: "back", layer: "shell", face: "back", why: "c", sides: [] },
    ]);
  });
});

describe("§44 the mitre and the groove, reckoned together", () => {
  const mitred = (keys) => ({
    type: "none", radius: 12, perEdge: true,
    by: Object.fromEntries(keys.map((k) => [k, { type: "mitre", radius: 18 }])),
  });
  const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
  const allSides = { depth: 6, sides: Object.fromEntries(
    ["front", "back", "left", "right", "top", "bottom"].map((s) => [s, true])) };

  const meshVolume = (pos) => {
    let v = 0;
    for (let i = 0; i < pos.length; i += 9) {
      const a = [pos[i], pos[i + 1], pos[i + 2]];
      const b = [pos[i + 3], pos[i + 4], pos[i + 5]];
      const c = [pos[i + 6], pos[i + 7], pos[i + 8]];
      v += (a[0] * (b[1] * c[2] - b[2] * c[1])
        - a[1] * (b[0] * c[2] - b[2] * c[0])
        + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
    return v;
  };

  it("cuts the mitre from the grooved part of the panel too", () => {
    // The bug: the loft stopped where the groove began and the rest was built
    // from plain boxes, so a panel with both kept the corner its mitre should
    // have taken off — a step where one gave way to the other.
    const d = derive({ ...DEFAULT_DESIGN, edge: mitred(VERTICALS), rebate: { top: allSides } });
    for (let i = 0; i < d.sol.panels.length; i += 1) {
      const panel = d.sol.panels[i];
      const { positions } = panelPositions(panel, d.bevelsOf(panel, i), d.sol.E);
      expect(meshVolume(positions), panel.face).toBeCloseTo(panelSolidVolume(panel), 6);
    }
  });

  it("is the invariant that would have caught it: the mesh is the model", () => {
    // What let it through was that the closure and the drawing were computed
    // the same wrong way, so they agreed with each other. They are checked
    // against each other now, over the shapes where they can disagree.
    for (const keys of [[], VERTICALS, ["front|left", "back|left"], ["left|top", "right|top"]]) {
      for (const face of ["front", "top", "left"]) {
        const d = derive({ ...DEFAULT_DESIGN, edge: mitred(keys), rebate: { [face]: allSides } });
        expect(d.sol.closureExact, `${face} with ${keys.length} mitres`).toBe(true);
        for (let i = 0; i < d.sol.panels.length; i += 1) {
          const panel = d.sol.panels[i];
          const { positions } = panelPositions(panel, d.bevelsOf(panel, i), d.sol.E);
          expect(meshVolume(positions), `${face}/${keys.length}/${panel.face}`)
            .toBeCloseTo(panelSolidVolume(panel), 6);
        }
      }
    }
  });

  it("takes the groove and the mitre off once between them, not once each", () => {
    const d = derive({ ...DEFAULT_DESIGN, edge: mitred(VERTICALS), rebate: { top: allSides } });
    const front = d.sol.panels.find((p) => p.face === "front" && p.layer === "shell");
    expect(front.mitres).toHaveLength(2);
    expect(front.notches).toHaveLength(1);
    // Where the tongue lands in the mitred corner, the material was already
    // gone: the two-term sum takes it off twice and comes out light.
    expect(panelSolidVolume(front)).toBeGreaterThan(panelVolume(front) - mitreLoss(front));
    // With no groove to overlap, the two agree exactly.
    const bare = derive({ ...DEFAULT_DESIGN, edge: mitred(VERTICALS) });
    for (const p of bare.sol.panels) {
      expect(panelSolidVolume(p)).toBeCloseTo(panelVolume(p) - mitreLoss(p), 6);
    }
  });

  it("clips a cell to the 45° face, and to the flat where the leg runs out", () => {
    const panel = { face: "front", box: { x: [0, 100], y: [0, 18], z: [0, 50] },
      mitres: [{ side: "left", leg: 18 }] };
    const whole = mitredCells(panel, panel.box);
    expect(whole).toHaveLength(1);
    // A triangle 18 × 18 off a 100 × 18 section, extruded 50 along z.
    expect(polyArea(whole[0].poly)).toBeCloseTo(100 * 18 - 162, 9);
    expect(whole[0].length).toBe(50);

    // A leg that stops short bends the boundary, so it comes back in pieces.
    const short = mitredCells({ ...panel, mitres: [{ side: "left", leg: 9 }] }, panel.box);
    expect(short.length).toBeGreaterThan(1);
    expect(short.reduce((a, p) => a + polyArea(p.poly), 0))
      .toBeCloseTo(100 * 18 - (40.5 + 9 * 9), 9);

    // No mitres, nothing to say.
    expect(mitredCells({ ...panel, mitres: [] }, panel.box)).toBe(null);
  });

  it("shows the refusals as warnings, which is the level the app renders", () => {
    // They were emitted at level "warn" and the app only renders "warning",
    // so every one of them went to the floor.
    const d = derive({ ...DEFAULT_DESIGN, rebate: { front: allSides } });
    const rebates = d.messages.filter((m) => /^Rebate:/.test(m.text));
    expect(rebates.length).toBeGreaterThan(0);
    for (const m of rebates) expect(m.level).toBe("warning");
  });
});

describe("§45 rebates where a part is drawn flat", () => {
  const letIn = () => derive({
    ...DEFAULT_DESIGN, preset: "sides", order: PROMINENCE_PRESETS[1].order,
    rebate: { front: { depth: 6, sides: { left: true, right: true, top: true, bottom: true } } },
  });

  it("puts the groove on the blank where the cutter will find it", () => {
    const d = letIn();
    for (const row of d.rows) {
      const blank = panelBlank(row.panel);
      const cut = blankNotches(row.panel, blank);
      expect(cut).toHaveLength(row.panel.notches?.length ?? 0);
      for (const r of cut) {
        // Inside the board, and never bigger than it.
        expect(r.x).toBeGreaterThanOrEqual(-1e-9);
        expect(r.y).toBeGreaterThanOrEqual(-1e-9);
        expect(r.x + r.w).toBeLessThanOrEqual(blank.length + 1e-9);
        expect(r.y + r.h).toBeLessThanOrEqual(blank.width + 1e-9);
        // The depth is the rebate's, not the board's: that is the difference
        // between a groove and a hole, and the whole reason it is drawn apart.
        expect(r.depth).toBe(6);
        expect(r.depth).toBeLessThan(row.thickness);
      }
    }
  });

  it("flips the width axis the way the fittings do", () => {
    // A template laid on the board has its work in the right places rather
    // than mirrored, so the groove has to use the transform the holes use.
    const panel = { face: "front", box: { x: [0, 200], y: [0, 18], z: [0, 100] },
      notches: [{ x: [0, 200], y: [12, 18], z: [0, 20] }] };
    const blank = panelBlank(panel);
    const [r] = blankNotches(panel, blank);
    // z 0–20 is the *bottom* of the panel, so it is the bottom of the blank.
    expect(r.y + r.h).toBeCloseTo(blank.width, 9);
    expect(r.h).toBeCloseTo(20, 9);
    expect(r.depth).toBeCloseTo(6, 9);
  });

  it("says it in the cut list, in the row and in the file", () => {
    const d = letIn();
    const grooved = d.rows.filter((r) => r.rebate);
    expect(grooved).toHaveLength(4);
    for (const r of grooved) expect(r.rebate).toMatch(/^6 × 18/);
    // The short form for a column, the sentence for under the template.
    expect(grooved[0].rebateNote).toBe(`Rebate ${grooved[0].rebate}`);
    expect(d.rows.find((r) => r.panel.face === "front").rebate).toBeUndefined();

    const csv = cutListCsv(d.rows).split("\n");
    expect(csv[0].split(",")).toContain("Rebate");
    const at = csv[0].split(",").indexOf("Rebate");
    const cells = csv.slice(1).map((line) => line.split(",")[at]);
    expect(cells.filter((c) => c && c !== '""')).toHaveLength(4);
  });

  it("draws it in its own colour, which is not the cutouts'", () => {
    // A cutout goes through the board and a rebate does not; on a template
    // across the room that is the distinction worth being able to make.
    expect(REBATE).not.toBe(ACCENT);
    expect(REBATE).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("§46 rebating a doubler", () => {
  const FACES = ["front", "back", "left", "right", "top", "bottom"];
  const every = (depth = 6) => ({ depth,
    sides: Object.fromEntries(FACES.map((s) => [s, true])) });
  /** A box with a doubler on each of the named faces. */
  const lined = (faces, rest = {}) => {
    let d = { ...DEFAULT_DESIGN, preset: "sides", order: PROMINENCE_PRESETS[1].order, ...rest };
    for (const f of faces) d = addPanel(d, "doubler", f);
    return d;
  };

  it("names a carcass panel by its face and anything else by both", () => {
    // §42 keyed a rebate by face alone, and those designs are still on disk.
    expect(rebateKey("shell", "front")).toBe("front");
    expect(rebateKey("doubler", "top")).toBe("doubler|top");
    expect(readRebateKey("front")).toEqual({ layer: "shell", face: "front" });
    expect(readRebateKey("doubler|top")).toEqual({ layer: "doubler", face: "top" });
    expect(rebateLabel("shell", "front")).toBe("Front");
    expect(rebateLabel("doubler", "top")).toBe("Top doubler");
    // The lining is not a board, and a groove in it is a dent.
    expect(REBATABLE).not.toContain("lagging");
  });

  it("lets a doubler into the doublers around it, and closes on volume", () => {
    const d = lined(FACES);
    const plain = derive(d);
    const cut = derive({ ...d, rebate: { "doubler|top": every(6) } });
    expect(cut.rebated["doubler|top"].sides).toEqual(["front", "back", "left", "right"]);
    expect(cut.rebateRejected.size).toBe(0);
    expect(cut.sol.closureExact).toBe(true);
    expect(cut.totals.closure).toBe("exact");
    // The box is the size it was: a rebate moves material, it does not add it.
    expect(cut.sol.E).toEqual(plain.sol.E);

    const row = (out, layer, face) =>
      out.rows.find((r) => r.panel.layer === layer && r.panel.face === face);
    expect(row(cut, "doubler", "top").length)
      .toBeCloseTo(row(plain, "doubler", "top").length + 12, 6);
    expect(row(cut, "doubler", "top").width)
      .toBeCloseTo(row(plain, "doubler", "top").width + 12, 6);
    // The doublers it goes into are the same blank with a groove noted in it.
    expect(row(cut, "doubler", "left").length).toBe(row(plain, "doubler", "left").length);
    expect(row(cut, "doubler", "left").rebate).toMatch(/^6 × 18/);
    // And the carcass, which the tongue never reaches, is untouched.
    expect(row(cut, "shell", "left").rebate).toBeUndefined();
  });

  it("lets a lone doubler into the carcass beside it", () => {
    // Nothing says the two panels of a rebate are in the same layer: with no
    // doubler on the sides, what is beside the top doubler is the carcass.
    const d = lined(["top"]);
    const cut = derive({ ...d, rebate: { "doubler|top": every(6) } });
    expect(cut.rebated["doubler|top"].sides).toEqual(["front", "back", "left", "right"]);
    expect(cut.sol.closureExact).toBe(true);
    expect(cut.rows.find((r) => r.panel.layer === "shell" && r.panel.face === "left").rebate)
      .toMatch(/^6 × 18/);
  });

  it("closes on volume for a doubler on any face, mitred or not", () => {
    const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
    const mitred = (keys) => ({ type: "none", radius: 12, perEdge: true,
      by: Object.fromEntries(keys.map((k) => [k, { type: "mitre", radius: 18 }])) });
    for (const keys of [[], VERTICALS]) {
      const d = lined(FACES, { edge: mitred(keys) });
      for (const face of FACES) {
        const out = derive({ ...d, rebate: { [`doubler|${face}`]: every(6) } });
        expect(out.sol.closureExact, `${face} with ${keys.length} mitres`).toBe(true);
        expect(out.totals.closure).toBe("exact");
      }
    }
  });

  it("cuts the layers from the outside in, so each is let into a settled one", () => {
    // The cladding, the carcass panel under it and the doubler behind that,
    // all rebated at once: each is let into its own layer's neighbours, and
    // the three grooves do not tread on each other.
    let d = lined(FACES, { preset: PROMINENCE_PRESETS[0].id, order: PROMINENCE_PRESETS[0].order });
    for (const f of FACES) d = addPanel(d, "cladding", f);
    const out = derive({ ...d,
      rebate: { top: every(6), "cladding|top": every(6), "doubler|top": every(6) } });
    for (const key of ["top", "cladding|top", "doubler|top"]) {
      expect(out.rebated[key].sides, key).toEqual(["front", "back", "left", "right"]);
    }
    expect(out.rebateRejected.size).toBe(0);
    expect(out.sol.closureExact).toBe(true);
  });

  it("lets a doubler in whichever way the box is wrapped", () => {
    // A doubler is inside the carcass whatever the prominence order does, so
    // there is always board beside it to be let into — which is not true of a
    // carcass panel, and is the reason this one never needs the order changing.
    for (const preset of PROMINENCE_PRESETS) {
      const d = lined(FACES, { preset: preset.id, order: preset.order });
      const out = derive({ ...d, rebate: { "doubler|top": every(6) } });
      expect(out.rebated["doubler|top"].sides, preset.id)
        .toEqual(["front", "back", "left", "right"]);
      expect(out.sol.closureExact, preset.id).toBe(true);
    }
  });

  it("will not cut a groove in the lining", () => {
    // The layers nest, so nothing but board is ever beside a board at its own
    // depth — but the rule is the rule, and a lining backing a rebate is not
    // backing at all.
    const panel = (layer, face, box) => ({ layer, face, box, mitres: [], notches: [] });
    const front = panel("shell", "front", { x: [18, 82], y: [0, 18], z: [18, 82] });
    const felt = panel("lagging", "left", { x: [0, 18], y: [0, 18], z: [0, 100] });
    const { applied, rejected } = applyRebates([front, felt],
      { front: { depth: 6, sides: { left: true } } });
    expect(applied.front).toBeUndefined();
    expect([...rejected.values()][0]).toMatch(/nothing there to rebate into|thin air/);
    expect(felt.notches).toHaveLength(0);
  });

  it("says which panel a refusal is about", () => {
    // "Top" named one board when §42 wrote it and names three now, so a
    // refusal that says only "Top" says nothing.
    let d = lined([], { preset: PROMINENCE_PRESETS[2].id, order: PROMINENCE_PRESETS[2].order });
    for (const f of FACES) d = addPanel(d, "cladding", f);
    // Top & bottom wrap, so the top cladding runs out past the sides: it is
    // the outermost board on that face and there is nothing to let it into.
    const out = derive({ ...d, rebate: { "cladding|top": every(6) } });
    expect(out.rebated["cladding|top"]).toBeUndefined();
    const warnings = out.messages.filter((m) => /^Rebate:/.test(m.text));
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) expect(w.text).toMatch(/^Rebate: Top cladding/);
    const problems = rebateProblems(out.rebateRejected);
    expect(problems.every((p) => p.key === "cladding|top" && p.layer === "cladding")).toBe(true);
  });
});
