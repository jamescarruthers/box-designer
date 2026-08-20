/**
 * §12 Mitred edges.
 *
 * A mitre is the one joint that changes two panels at once: the butting panel
 * grows out to the corner and both are cut back 45°. So the things worth
 * pinning down are that the box still closes on volume, that the cavity does
 * not move, and that both panels — not just whichever owns the outer corner —
 * carry the cut.
 */
import { describe, it, expect } from "vitest";
import { solve, boxVolume } from "../src/model/solver.js";
import { EDGES, PROMINENCE_PRESETS, AXIS } from "../src/model/constants.js";
import {
  mitreCheck, mitrableEdges, applyMitres, mitreLoss, mitreBevels, mitreIssues,
} from "../src/model/mitre.js";
import { panelBevels, edgeOwners, panelEdgeNote, insetAt } from "../src/model/bevel.js";
import { panelPositions } from "../src/three/panelGeometry.js";
import { buildOrthoView } from "../src/drawing/views.js";
import { buildIsometric } from "../src/drawing/iso.js";
import { DEFAULT_DESIGN, derive, edgeMap, mitreMap } from "../src/ui/design.js";

const carcass = (order = PROMINENCE_PRESETS[0].order) =>
  solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order });

const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];

const shellOf = (panels, face) => panels.find((p) => p.face === face && p.layer === "shell");

/**
 * The volume of the built solid: (1/6) Σ a · (b × c) over outward-facing
 * triangles. Taken from `panelPositions`, which is where the winding is fixed;
 * `panelSolid` emits its rings in whatever order they were built.
 */
function meshVolume(panel, bevels, E) {
  const { positions } = panelPositions(panel, bevels, E);
  let v = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const [a, b, c] = [0, 1, 2].map((t) => positions.slice(i + t * 3, i + t * 3 + 3));
    v += a[0] * (b[1] * c[2] - b[2] * c[1])
       - a[1] * (b[0] * c[2] - b[2] * c[0])
       + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return Math.abs(v) / 6;
}

const mitred = (keys, order = PROMINENCE_PRESETS[0].order) => {
  const sol = carcass(order);
  const shells = sol.panels.filter((p) => p.layer === "shell");
  const { panels } = applyMitres(shells, sol.env, Object.fromEntries(keys.map((k) => [k, true])));
  return { sol, panels };
};

describe("§12 which edges can take a mitre", () => {
  it("needs a panel on both faces, both running the edge, both the same thickness", () => {
    const sol = carcass();
    for (const key of VERTICALS) expect(mitreCheck(sol.panels, sol.env, key).ok).toBe(true);
  });

  it("refuses an edge one of the panels does not run, and says which", () => {
    const sol = carcass();
    const blocked = EDGES.filter((k) => !mitreCheck(sol.panels, sol.env, k).ok);
    expect(blocked.length).toBeGreaterThan(0);
    for (const k of blocked) {
      expect(mitreCheck(sol.panels, sol.env, k).why).toMatch(/does not run the whole edge|no shell panel/);
    }
  });

  it("offers 1, 2 or 4 mitrable edges, never some other count", () => {
    const counts = new Set();
    for (const preset of PROMINENCE_PRESETS) {
      const sol = carcass(preset.order);
      counts.add(Object.values(mitrableEdges(sol.panels, sol.env)).filter((c) => c.ok).length);
    }
    expect([...counts].every((n) => [1, 2, 4].includes(n))).toBe(true);
  });

  it("refuses when the two panels are different thicknesses", () => {
    const sol = solve({
      envelope: { x: 236, y: 286, z: 356 },
      thickness: { front: 18, back: 18, left: 12, right: 12, top: 18, bottom: 18 },
      order: PROMINENCE_PRESETS[0].order,
    });
    expect(mitreCheck(sol.panels, sol.env, "front|left").why).toMatch(/a mitre needs them equal/);
  });
});

describe("§12 what a mitre does to the panels", () => {
  it("grows only the panel that was butting", () => {
    const sol = carcass();
    const before = sol.panels.filter((p) => p.layer === "shell").map((p) => ({ ...p.box }));
    const { panels } = mitred(VERTICALS);
    const grew = panels.filter((p, i) => JSON.stringify(p.box) !== JSON.stringify(before[i]));
    // Front and back wrap in this preset, so it is left and right that grow.
    expect(grew.map((p) => p.face).sort()).toEqual(["left", "right"]);
    expect(shellOf(panels, "left").box.y).toEqual([sol.env.y[0], sol.env.y[1]]);
  });

  it("still closes on volume, exactly", () => {
    for (const keys of [[], ["front|left"], VERTICALS]) {
      const { sol, panels } = mitred(keys);
      const loss = panels.reduce((a, p) => a + mitreLoss(p), 0);
      const solid = panels.reduce((a, p) => a + boxVolume(p.box), 0) - loss;
      expect(solid + boxVolume(sol.cavity)).toBeCloseTo(sol.envVolume, 6);
    }
  });

  it("takes off a triangular prism per mitred side", () => {
    const { panels } = mitred(["front|left"]);
    const left = shellOf(panels, "left");
    expect(left.mitres).toHaveLength(1);
    expect(mitreLoss(left)).toBeCloseTo((18 * 18 / 2) * (left.box.z[1] - left.box.z[0]), 9);
  });

  it("leaves the cavity where it was — a mitre moves material, it does not add wall", () => {
    const plain = derive(DEFAULT_DESIGN);
    const design = { ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, perEdge: true, by: { "front|left": { type: "mitre" } } } };
    const cut = derive(design);
    expect(cut.sol.internal).toEqual(plain.sol.internal);
    expect(cut.sol.closureExact).toBe(true);
  });
});

describe("§12 the mitre as an edge treatment", () => {
  it("cuts both panels, not just whichever owns the outer corner", () => {
    const { sol, panels } = mitred(["front|left"]);
    const owners = edgeOwners(sol.env, panels);
    const bevels = panels.map((p, i) => panelBevels(i, p, {}, owners));
    const cutting = panels.map((p, i) => [p.face, bevels[i]]).filter(([, b]) => Object.keys(b).length);
    expect(cutting.map(([f]) => f).sort()).toEqual(["front", "left"]);
    expect(bevels[panels.indexOf(shellOf(panels, "front"))].left).toEqual({ type: "mitre", radius: 18 });
    expect(bevels[panels.indexOf(shellOf(panels, "left"))].front).toEqual({ type: "mitre", radius: 18 });
  });

  it("opens out toward the inner face, the opposite way to a chamfer", () => {
    expect(insetAt("mitre", 18, 0)).toBe(0);
    expect(insetAt("mitre", 18, 9)).toBe(9);
    expect(insetAt("mitre", 18, 18)).toBe(18);
    expect(insetAt("chamfer", 18, 0)).toBe(18);
    expect(insetAt("chamfer", 18, 18)).toBe(0);
  });

  it("gives the solid the volume the arithmetic says it should", () => {
    const { sol, panels } = mitred(VERTICALS);
    for (const p of panels) {
      expect(meshVolume(p, mitreBevels(p), sol.E)).toBeCloseTo(boxVolume(p.box) - mitreLoss(p), 6);
    }
  });

  it("names the cut in the cut list", () => {
    const { panels } = mitred(VERTICALS);
    expect(panelEdgeNote(mitreBevels(shellOf(panels, "front")))).toBe("45° left, right");
  });

  it("warns, and leaves a butt joint, where the mitre cannot be cut", () => {
    const sol = carcass();
    const bad = EDGES.find((k) => !mitreCheck(sol.panels, sol.env, k).ok);
    const msgs = mitreIssues(mitrableEdges(sol.panels, sol.env), { [bad]: true });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toMatch(/Left as a butt joint/);
    const { applied } = applyMitres(sol.panels, sol.env, { [bad]: true });
    expect(applied).toEqual([]);
  });

  it("is exclusive with a decorative bevel on the same edge", () => {
    const design = { ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, perEdge: true,
      by: { "front|left": { type: "mitre" }, "front|top": { type: "fillet", radius: 6 } } } };
    expect(edgeMap(design)["front|left"]).toEqual({ type: "none", radius: 0 });
    expect(edgeMap(design)["front|top"]).toEqual({ type: "fillet", radius: 6 });
    expect(mitreMap(design)).toEqual({ "front|left": true });
  });
});

describe("§12 mitres in the drawing", () => {
  const view = (v, keys = VERTICALS) => {
    const { sol, panels } = mitred(keys);
    return buildOrthoView(v, { ...sol, panels }, {});
  };

  it("draws the diagonal across the corner square, in the view that sees it", () => {
    const plan = view("plan");
    const diagonals = plan.lines.filter((l) => l.kind === "mitre");
    expect(diagonals).toHaveLength(4);
    for (const d of diagonals) {
      expect(Math.abs(d.b[0] - d.a[0])).toBeCloseTo(18, 9);
      expect(Math.abs(d.b[1] - d.a[1])).toBeCloseTo(18, 9);
    }
    // One of them runs out of the origin corner of the plan.
    expect(diagonals.some((d) => d.a[0] === 0 && d.a[1] === 0)).toBe(true);
  });

  it("takes the butt lines out of the square it replaces", () => {
    // Both panels were grown out to the corner, so without the trim each would
    // draw its inner face straight across the square the other half belongs to.
    const cut = view("plan");
    const crosses = cut.lines.filter((l) => l.kind === "hlr" &&
      Math.min(l.a[0], l.b[0]) < 18 - 1e-9 && Math.min(l.a[1], l.b[1]) < 18 - 1e-9);
    expect(crosses.filter((l) => l.a[0] !== 0 && l.a[1] !== 0)).toHaveLength(0);
    // The inner faces now start where the mitre leaves off.
    const inner = cut.lines.filter((l) => l.a[1] === 18 && l.b[1] === 18);
    expect(inner.map((l) => l.a[0])).toEqual([18]);
  });

  it("shows no diagonal where the joint is edge-on", () => {
    for (const v of ["front", "end"]) {
      expect(view(v).lines.filter((l) => l.kind === "mitre")).toHaveLength(0);
    }
  });

  it("leaves an edge-on view alone: the front panel already covered that corner", () => {
    // Both panels reach the corner now, so their depths tie and the one behind
    // would start drawing a visible seam. Sending it back to the butt line —
    // which is where its material really ends — keeps the view as it was.
    expect(view("front").lines).toEqual(buildOrthoView("front", carcass(), {}).lines);
  });

  it("takes the wrapping panel's end grain off the face it no longer reaches", () => {
    // Front and back wrap here, so their ends show on the left and right faces.
    // Mitre the vertical edges and those seams are gone.
    const plain = buildOrthoView("end", carcass(), {});
    const cut = view("end");
    const seams = (o) => o.lines.filter((l) => l.visible && l.a[1] !== l.b[1] &&
      Math.min(l.a[0], l.b[0]) > 0 && Math.max(l.a[0], l.b[0]) < o.ext.h);
    expect(seams(plain).length).toBeGreaterThan(0);
    expect(seams(cut)).toHaveLength(0);
  });

  it("keeps the outline: the envelope corner is still sharp", () => {
    const plain = buildOrthoView("plan", carcass(), {});
    const cut = view("plan");
    const outline = (o) => o.lines
      .filter((l) => l.kind === "hlr" && (l.a[0] === 0 || l.a[1] === 0) && (l.b[0] === 0 || l.b[1] === 0))
      .map((l) => JSON.stringify([l.a, l.b])).sort();
    expect(outline(cut)).toEqual(outline(plain));
  });

  it("stops a mitred panel claiming a face it only touches along a line", () => {
    const { sol, panels } = mitred(VERTICALS);
    const iso = buildIsometric({ ...sol, panels });
    const plain = buildIsometric({ ...sol, panels: sol.panels.filter((p) => p.layer === "shell") });
    expect(iso.lines.length).toBeLessThan(plain.lines.length);
  });
});
