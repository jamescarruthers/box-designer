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
  mitreCheck, mitrableEdges, applyMitres, resolveMitres, mitreLoss, mitreBevels, mitreIssues,
} from "../src/model/mitre.js";
import { panelBevels, edgeOwners, panelEdgeNote, insetAt } from "../src/model/bevel.js";
import { panelPositions } from "../src/three/panelGeometry.js";
import { buildOrthoView } from "../src/drawing/views.js";
import { buildIsometric } from "../src/drawing/iso.js";
import { DEFAULT_DESIGN, derive, edgeMap, mitreMap } from "../src/ui/design.js";

const carcass = (order = PROMINENCE_PRESETS[0].order) =>
  solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order });

const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
// Under the standard prominence the front and back wrap and the other four
// panels form a tube between them. Its four long corners mitre too.
const TUBE = ["left|bottom", "left|top", "right|bottom", "right|top"];

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

  it("takes the tube between the front and back, which never reaches the envelope", () => {
    // The reason the envelope test was wrong: these four panels coincide
    // exactly along y and butt against the front and back at each end.
    const sol = carcass();
    for (const key of TUBE) {
      const check = mitreCheck(sol.panels, sol.env, key);
      expect(check.ok, `${key}: ${check.why}`).toBe(true);
    }
    const left = shellOf(sol.panels, "left"), top = shellOf(sol.panels, "top");
    expect(left.box.y).toEqual(top.box.y);
    expect(left.box.y).not.toEqual([sol.env.y[0], sol.env.y[1]]);
  });

  it("refuses an edge where one panel runs past the other", () => {
    const sol = carcass();
    const blocked = EDGES.filter((k) => !mitreCheck(sol.panels, sol.env, k).ok);
    // Front and back wrap the full width; the top and bottom do not reach
    // their ends, so a mitre there would come out in mid-air.
    expect(blocked.sort()).toEqual(["back|bottom", "back|top", "front|bottom", "front|top"].sort());
    for (const k of blocked) {
      expect(mitreCheck(sol.panels, sol.env, k).why).toMatch(/runs past the other/);
    }
  });

  it("offers a mitre on eight of the twelve edges, two full rings", () => {
    for (const preset of PROMINENCE_PRESETS) {
      const sol = carcass(preset.order);
      const ok = EDGES.filter((k) => mitrableEdges(sol.panels, sol.env)[k].ok);
      expect(ok.length, preset.id).toBeGreaterThanOrEqual(6);
      expect(ok.length, preset.id).toBeLessThanOrEqual(8);
    }
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
    for (const keys of [[], ["front|left"], VERTICALS, TUBE, ["left|top"], [...VERTICALS, ...TUBE]]) {
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
    const { applied, rejected } = applyMitres(sol.panels, sol.env, { [bad]: true });
    expect(applied).toEqual([]);
    const msgs = mitreIssues(rejected);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toMatch(/Left as a butt joint/);
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

  it("runs a mitred panel out to the corner, where a butted one stops short", () => {
    // §38 The isometric draws panels as boxes now, and a mitred panel's box was
    // grown to the corner before it was cut back to it — so the mitre needs no
    // special case in the drawing: the front runs the full width of the box and
    // there is no thickness of side panel showing beside it.
    const { sol, panels } = mitred(VERTICALS);
    const spread = (ps) => Object.fromEntries(buildIsometric({ ...sol, panels: ps })
      .groups.filter((g) => g.layer === "shell").map((g) => {
        const pts = g.fills.flatMap((f) => f.pts);
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        return [g.face, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))];
      }));
    const butt = spread(sol.panels.filter((p) => p.layer === "shell"));
    const cut = spread(panels);
    // The panel that was butting grew out to the corner; the one that already
    // wrapped is where it was. Nothing shrank: a mitre takes material off the
    // joint face, not off the length of the panel.
    expect(Object.keys(cut).some((f) => cut[f] > butt[f])).toBe(true);
    for (const f of Object.keys(cut)) expect(cut[f]).toBeGreaterThanOrEqual(butt[f]);
  });
});


/**
 * Mitres are not independent. Cutting one grows a panel, and a longer panel can
 * run past a joint another mitre needs — which is how the volume stopped
 * closing by exactly one thickness cubed per conflicting pair.
 */
describe("§12 mitres that rule each other out", () => {
  it("takes either ring on its own, in full", () => {
    const sol = carcass();
    for (const ring of [VERTICALS, TUBE]) {
      const { applied } = applyMitres(sol.panels, sol.env, Object.fromEntries(ring.map((k) => [k, true])));
      expect(applied.sort()).toEqual([...ring].sort());
    }
  });

  it("refuses the second ring, because a panel takes opposite sides and not adjacent ones", () => {
    const sol = carcass();
    const both = Object.fromEntries([...VERTICALS, ...TUBE].map((k) => [k, true]));
    const { applied, rejected } = applyMitres(sol.panels, sol.env, both);
    expect(applied.sort()).toEqual([...VERTICALS].sort());
    expect([...rejected.keys()].sort()).toEqual([...TUBE].sort());
    for (const why of rejected.values()) expect(why).toMatch(/opposite sides, not adjacent ones/);
  });

  it("keeps the volume closing when a conflicting pair is asked for", () => {
    // Both mitres are individually exact; applying both once cost 18³.
    const sol = carcass();
    const { panels } = applyMitres(sol.panels, sol.env, { "front|left": true, "left|top": true });
    const loss = panels.reduce((a, p) => a + mitreLoss(p), 0);
    const solid = panels.reduce((a, p) => a + boxVolume(p.box), 0) - loss;
    expect(solid + boxVolume(sol.cavity)).toBeCloseTo(sol.envVolume, 6);
  });

  it("never lets a panel escape the envelope, whatever is asked for", () => {
    const sol = carcass();
    const { panels } = applyMitres(sol.panels, sol.env,
      Object.fromEntries(EDGES.map((k) => [k, true])));
    for (const p of panels) {
      for (const ax of ["x", "y", "z"]) {
        expect(p.box[ax][0]).toBeGreaterThanOrEqual(sol.env[ax][0]);
        expect(p.box[ax][1]).toBeLessThanOrEqual(sol.env[ax][1]);
      }
    }
  });

  it("does not depend on the order the edges were asked for", () => {
    const sol = carcass();
    const keys = [...VERTICALS, ...TUBE];
    const one = resolveMitres(sol.panels, sol.env, Object.fromEntries(keys.map((k) => [k, true])));
    const other = resolveMitres(sol.panels, sol.env,
      Object.fromEntries([...keys].reverse().map((k) => [k, true])));
    expect(one.accepted).toEqual(other.accepted);
  });

  it("leaves one standing when two rule each other out, rather than neither", () => {
    const sol = carcass();
    const { applied } = applyMitres(sol.panels, sol.env, { "front|left": true, "left|top": true });
    expect(applied).toEqual(["front|left"]);
  });
});

describe("§12 what the control may still offer", () => {
  const withMitres = (keys) => derive({
    ...DEFAULT_DESIGN,
    edge: { ...DEFAULT_DESIGN.edge, perEdge: true,
      by: Object.fromEntries(keys.map((k) => [k, { type: "mitre" }])) },
  });

  it("offers both rings before anything is chosen", () => {
    const d = withMitres([]);
    expect(Object.entries(d.mitrable).filter(([, c]) => c.ok).map(([k]) => k).sort())
      .toEqual([...VERTICALS, ...TUBE].sort());
  });

  it("closes off the ring that would displace what is already chosen", () => {
    const d = withMitres(TUBE);
    expect(d.messages).toEqual([]);
    for (const k of TUBE) expect(d.mitrable[k].ok, k).toBe(true);
    for (const k of VERTICALS) {
      expect(d.mitrable[k].ok, k).toBe(false);
      expect(d.mitrable[k].why).toMatch(/would undo the/);
    }
  });

  it("closes off only the edges the chosen one actually touches", () => {
    const d = withMitres(["front|left"]);
    // The left panel is now committed; the right one is still free.
    expect(d.mitrable["left|top"].ok).toBe(false);
    expect(d.mitrable["right|top"].ok).toBe(true);
  });

  it("offers a ring the shortcut can apply without a single warning", () => {
    const d = withMitres([]);
    expect(d.mitreRing.length).toBeGreaterThan(0);
    expect(withMitres(d.mitreRing).messages).toEqual([]);
  });
});


/**
 * §12 A mitre with cladding on the box.
 *
 * The corner a mitred panel grows to is the other panel's outer face. Those are
 * the same thing on a bare carcass, so the envelope stood in for it — until
 * cladding went on, which sits outside the shell and moves the envelope without
 * moving the shell's own corner. The mitred panel then grew straight through
 * the cladding. Found by a storage test that happened to save a clad, mitred
 * box; §2.4 had been calling it a bug all along, correctly.
 */
describe("§12 mitres under cladding", () => {
  const clad = (extra, keys) => derive({
    ...DEFAULT_DESIGN,
    ...extra,
    edge: { ...DEFAULT_DESIGN.edge, perEdge: true,
      by: Object.fromEntries(keys.map((k) => [k, { type: "mitre" }])) },
  });
  const SKINS = [
    ["bare", {}],
    ["cladding on the front", { cladding: { front: { material: "birch", thickness: 6 } } }],
    ["cladding all round", { cladding: Object.fromEntries(
      ["front", "back", "left", "right", "top", "bottom"].map((f) => [f, { material: "birch", thickness: 6 }])) }],
    ["cladding and a doubler", {
      cladding: { front: { material: "birch", thickness: 6 } },
      doubler: { back: { material: "mdf", thickness: 12 } },
    }],
  ];

  it.each(SKINS)("closes on volume with %s", (_label, extra) => {
    for (const keys of [VERTICALS, TUBE, ["front|left"]]) {
      const d = clad(extra, keys);
      expect(d.sol.closureExact).toBe(true);
      expect(d.messages.filter((m) => m.level === "error")).toEqual([]);
    }
  });

  it("stops the grown panel at the carcass corner, not at the cladding's", () => {
    const d = clad({ cladding: { front: { material: "birch", thickness: 6 } } }, ["front|left"]);
    const shell = (face) => d.sol.panels.find((p) => p.face === face && p.layer === "shell");
    // The cladding occupies y 0–6; the shell front starts where it ends.
    expect(shell("front").box.y[0]).toBe(6);
    expect(shell("left").box.y[0]).toBe(6);
    expect(shell("left").box.y[0]).not.toBe(d.sol.env.y[0]);
  });

  it("never lets a mitred panel overlap the cladding in front of it", () => {
    const d = clad({ cladding: { front: { material: "birch", thickness: 6 } } }, VERTICALS);
    const cladding = d.sol.panels.find((p) => p.layer === "cladding");
    for (const p of d.sol.panels.filter((q) => q.layer === "shell")) {
      const overlaps = ["x", "y", "z"].every((ax) =>
        Math.min(p.box[ax][1], cladding.box[ax][1]) - Math.max(p.box[ax][0], cladding.box[ax][0]) > 1e-9);
      expect(overlaps, `${p.face} runs into the cladding`).toBe(false);
    }
  });
});
