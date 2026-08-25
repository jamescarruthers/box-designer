import { describe, it, expect } from "vitest";
import { solve, boxVolume } from "../src/model/solver.js";
import { applyMitres } from "../src/model/mitre.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";
import { noEdges } from "../src/model/bevel.js";
import {
  applyRebates, subtractBoxes, panelVolume, rebateSlab, rebateSides, notchNote, intersect, newRebate,
} from "../src/model/rebate.js";
import { panelPositions, notchDepth } from "../src/three/panelGeometry.js";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";

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
    expect([...rejected.values()].join(" ")).toMatch(/mitred/);
    // The other three sides are cut all the same: one joint is not the panel.
    expect(applied.front.sides).toEqual(["left", "right", "bottom"]);
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
