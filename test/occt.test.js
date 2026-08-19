/**
 * §11 The OpenCASCADE path.
 *
 * These run against the full prebuilt `opencascade.js` package rather than the
 * trimmed build in occt/: the trimmed one is compiled with -pthread and its
 * worker calls `require`, which Node rejects in a "type": "module" package.
 * Both expose the same API, and the adapter takes the kernel as an argument
 * precisely so either will do.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { solve } from "../src/model/solver.js";
import {
  noEdges, uniformEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels,
} from "../src/model/bevel.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";
import { assembly, volumeOf, panelSolid, edgesOf } from "../src/occt/solids.js";
import { viewGeometry, hiddenLineRemoval, isoGeometry, VIEW_AXES, ISO_VIEW } from "../src/occt/hlr.js";
import { buildIsometric } from "../src/drawing/iso.js";
import { mergeViewLines, describe as describeLines } from "../src/occt/merge.js";
import { triangulate, meshPanels } from "../src/occt/mesh.js";
import { edgeSegments } from "../src/occt/edges.js";
import { viewLines, segEnds } from "../src/drawing/hlr.js";
import { panelPositions, inwardCount } from "../src/three/panelGeometry.js";

let oc;
beforeAll(async () => {
  const { default: init } = await import("opencascade.js/dist/node.js");
  oc = await init();
}, 180000);

const carcass = (order = PROMINENCE_PRESETS[0].order, extra = {}) =>
  solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order, ...extra });

const build = (sol, edges) => {
  const owners = edgeOwners(sol.env, sol.panels);
  return assembly(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners));
};

const analyticDescription = (sol, view) => describeLines(viewLines(sol.panels, view, sol.E).map((s) => {
  const [a, b] = segEnds(s);
  return { a, b, visible: s.visible };
}));

const kernelDescription = (shape, sol, view) =>
  describeLines(mergeViewLines(viewGeometry(oc, shape, view, sol.E).lines).lines);

describe("the kernel agrees with the analytic engine", () => {
  it.each(PROMINENCE_PRESETS.slice(0, 3))("$name: identical lines in all three views", (preset) => {
    const sol = carcass(preset.order);
    const shape = build(sol, noEdges());
    for (const view of ["front", "end", "plan"]) {
      expect(kernelDescription(shape, sol, view)).toEqual(analyticDescription(sol, view));
    }
  }, 120000);

  it("reproduces the §6.3 verified end view", () => {
    const sol = carcass();
    expect(kernelDescription(build(sol, noEdges()), sol, "end")).toEqual([
      "dashed horiz 18 18..268",
      "dashed horiz 338 18..268",
      "solid  horiz 0 0..286",
      "solid  horiz 356 0..286",
      "solid  vert  0 0..356",
      "solid  vert  18 0..356",
      "solid  vert  268 0..356",
      "solid  vert  286 0..356",
    ]);
  }, 120000);

  it("agrees on a clad and doubled box too", () => {
    const sol = carcass(PROMINENCE_PRESETS[0].order, { cladding: { front: 6 }, doubler: { back: 12 } });
    const shape = build(sol, noEdges());
    for (const view of ["front", "end", "plan"]) {
      expect(kernelDescription(shape, sol, view)).toEqual(analyticDescription(sol, view));
    }
  }, 120000);
});

describe("§2.4 closure, checked against the kernel", () => {
  it("gives the same panel volume as the solver when the edges are square", () => {
    const sol = carcass();
    const analytic = sol.panels.reduce((a, p) =>
      a + (p.box.x[1] - p.box.x[0]) * (p.box.y[1] - p.box.y[0]) * (p.box.z[1] - p.box.z[0]), 0);
    expect(volumeOf(oc, build(sol, noEdges()))).toBeCloseTo(analytic, 3);
  }, 120000);

  it("reports less once fillets are cut, which the analytic model cannot know", () => {
    const sol = carcass();
    const cont = fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
    const square = volumeOf(oc, build(sol, noEdges()));
    const filleted = volumeOf(oc, build(sol, applicableEdges(uniformEdges("fillet", 12), cont)));
    expect(filleted).toBeLessThan(square);
    // Eight continuous edges, each losing (1 − π/4)R² per unit length.
    expect(square - filleted).toBeGreaterThan(0);
    expect((square - filleted) / square).toBeLessThan(0.05);
  }, 120000);
});

describe("§6.4 the kernel separates smooth edges from sharp", () => {
  it("finds tangential edges on a filleted box and none on a square one", () => {
    const sol = carcass();
    const cont = fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
    const square = hiddenLineRemoval(oc, build(sol, noEdges()), "front", sol.E);
    const filleted = hiddenLineRemoval(oc, build(sol, applicableEdges(uniformEdges("fillet", 12), cont)), "front", sol.E);
    expect(square.smoothVisible).toHaveLength(0);
    expect(filleted.smoothVisible.length).toBeGreaterThan(0);
  }, 120000);

  it("omits them by default, which is the ISO 128 rule §6.4 had to hand-code", () => {
    const sol = carcass();
    const cont = fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
    const shape = build(sol, applicableEdges(uniformEdges("fillet", 12), cont));
    const without = viewGeometry(oc, shape, "front", sol.E);
    const with_ = viewGeometry(oc, shape, "front", sol.E, { tangentEdges: true });
    expect(without.lines.some((l) => l.kind === "tangent")).toBe(false);
    expect(with_.lines.some((l) => l.kind === "tangent")).toBe(true);
    expect(with_.lines.length).toBeGreaterThan(without.lines.length);
  }, 120000);
});

describe("§3 bevels land on the edges the analytic model chose", () => {
  it("adds curved faces only where a treatment applies", () => {
    const sol = carcass();
    const cont = fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
    const owners = edgeOwners(sol.env, sol.panels);
    const i = sol.panels.findIndex((p) => p.face === "front");
    const edges = applicableEdges(uniformEdges("fillet", 12), cont);
    const plain = edgesOf(oc, panelSolid(oc, sol.panels[i], {}));
    const round = edgesOf(oc, panelSolid(oc, sol.panels[i], panelBevels(i, sol.panels[i], edges, owners)));
    expect(plain).toHaveLength(12);
    expect(round.length).toBeGreaterThan(12);
  }, 120000);
});

describe("merging what the kernel emits", () => {
  it("drops a hidden segment lying under a visible one", () => {
    const merged = mergeViewLines([
      { a: [0, 0], b: [100, 0], visible: false },
      { a: [0, 0], b: [100, 0], visible: true },
    ]);
    expect(merged.lines).toEqual([{ a: [0, 0], b: [100, 0], visible: true, kind: "hlr" }]);
  });

  it("merges an outline reported by four separate solids", () => {
    const merged = mergeViewLines([
      { a: [0, 0], b: [50, 0], visible: true },
      { a: [50, 0], b: [80, 0], visible: true },
      { a: [80, 0], b: [120, 0], visible: true },
    ]);
    expect(merged.lines).toEqual([{ a: [0, 0], b: [120, 0], visible: true, kind: "hlr" }]);
  });

  it("splits a partial overlap so visible still wins on the shared part", () => {
    const merged = mergeViewLines([
      { a: [0, 0], b: [100, 0], visible: false },
      { a: [40, 0], b: [60, 0], visible: true },
    ]);
    expect(merged.lines).toHaveLength(3);
    expect(merged.lines.filter((l) => l.visible).map((l) => [l.a[0], l.b[0]])).toEqual([[40, 60]]);
  });

  it("keeps curves, deduping them by endpoint", () => {
    const arc = { a: [0, 0], b: [10, 10], visible: true };
    expect(mergeViewLines([arc, { ...arc }]).lines).toHaveLength(1);
  });
});

describe("§6.6 the isometric, from the kernel", () => {
  const sol = carcass();

  it("lands on the same projection as §6.6's own formula", () => {
    // Not a rotation of it: the x direction (1,1,0) is what makes OCCT's
    // projection agree with ISO_X/ISO_Y/ISO_Z rather than merely resemble it.
    expect(ISO_VIEW).toEqual({ dir: [1, -1, 1], xdir: [1, 1, 0] });
    const kernel = isoGeometry(oc, build(sol, noEdges()), sol.E);
    const analytic = buildIsometric(sol);
    expect(kernel.ext.h).toBeCloseTo(analytic.ext.h, 6);
    expect(kernel.ext.v).toBeCloseTo(analytic.ext.v, 6);
  }, 120000);

  it("shows the edge treatments the analytic isometric cannot", () => {
    const cont = fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
    const edges = applicableEdges(uniformEdges("fillet", 12), cont);
    const filleted = isoGeometry(oc, build(sol, edges), sol.E);
    const square = isoGeometry(oc, build(sol, noEdges()), sol.E);
    expect(filleted.lines.length).toBeGreaterThan(square.lines.length * 3);
    // The round-overs eat into the outer corners, so the pictorial gets smaller.
    expect(filleted.ext.h).toBeLessThan(square.ext.h);
    expect(filleted.ext.v).toBeLessThan(square.ext.v);
    // §10 recorded this as a gap: the analytic isometric takes no edge
    // treatment at all, so it draws the same hard-cornered box either way.
    expect(buildIsometric(sol).lines.length).toBeLessThan(filleted.lines.length / 3);
  }, 120000);

  it("carries visible detail only, as a pictorial should", () => {
    expect(isoGeometry(oc, build(sol, noEdges()), sol.E).lines.every((l) => l.visible)).toBe(true);
  }, 120000);

  it("starts at the origin of its own bounding box", () => {
    const iso = isoGeometry(oc, build(sol, noEdges()), sol.E);
    const xs = iso.lines.flatMap((l) => [l.a[0], l.b[0]]);
    const ys = iso.lines.flatMap((l) => [l.a[1], l.b[1]]);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
  }, 120000);
});

describe("§4 triangles for the 3D view", () => {
  const sol = carcass();
  const owners = () => edgeOwners(sol.env, sol.panels);
  const bevelsFor = (edges) => (i, p) => panelBevels(i, p, edges, owners());

  it("meshes a square carcass to the same triangle count as the ring stack", () => {
    const meshed = meshPanels(oc, sol.panels, bevelsFor(noEdges()), sol.E);
    expect(meshed.reduce((a, m) => a + m.triangles, 0)).toBe(72);   // six boxes, twelve each
  }, 120000);

  it("gives a filleted box more triangles than the ring stack, having the corner blends", () => {
    const cont = fullLengthEdges(sol.env, sol.panels, owners());
    const edges = applicableEdges(uniformEdges("fillet", 12), cont);
    const kernel = meshPanels(oc, sol.panels, bevelsFor(edges), sol.E)
      .reduce((a, m) => a + m.triangles, 0);
    const ring = sol.panels
      .map((p, i) => panelPositions(p, panelBevels(i, p, edges, owners()), sol.E))
      .reduce((a, m) => a + m.triangles, 0);
    expect(kernel).toBeGreaterThan(ring);
  }, 120000);

  it("§4.4 leaves every triangle facing outward", () => {
    const cont = fullLengthEdges(sol.env, sol.panels, owners());
    const edges = applicableEdges(uniformEdges("fillet", 12), cont);
    for (const m of meshPanels(oc, sol.panels, bevelsFor(edges), sol.E)) {
      expect(inwardCount(m.positions, m.centroid)).toBe(0);
      expect(m.flipped).toBeGreaterThan(0);   // OCCT hands back both windings
    }
  }, 120000);

  it("puts the mesh in three coordinates, centred on the envelope", () => {
    const [m] = meshPanels(oc, sol.panels.slice(0, 1), () => ({}), sol.E);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      lo = Math.min(lo, m.positions[i]); hi = Math.max(hi, m.positions[i]);
    }
    // The front panel spans the full width, so x runs −E.x/2 … +E.x/2.
    expect(lo).toBeCloseTo(-sol.E.x / 2, 6);
    expect(hi).toBeCloseTo(sol.E.x / 2, 6);
  }, 120000);

  it("takes a finer angular deflection for a rounder surface", () => {
    const cont = fullLengthEdges(sol.env, sol.panels, owners());
    const edges = applicableEdges(uniformEdges("fillet", 12), cont);
    const i = sol.panels.findIndex((p) => p.face === "front");
    const solid = (d) => triangulate(oc, panelSolid(oc, sol.panels[i], panelBevels(i, sol.panels[i], edges, owners())), sol.E, d);
    // Angle is what drives the tessellation of a fillet, not chord height:
    // at R12 the linear deflection is slack long before the angular one is.
    expect(solid({ angular: 0.05 }).triangles).toBeGreaterThan(solid({ angular: 1.2 }).triangles);
  }, 120000);
});

describe("§4 the edge overlay comes from the topology", () => {
  const sol = carcass();
  const owners = () => edgeOwners(sol.env, sol.panels);
  const solidFor = (edges) => {
    const i = sol.panels.findIndex((p) => p.face === "front");
    return panelSolid(oc, sol.panels[i], panelBevels(i, sol.panels[i], edges, owners()));
  };

  it("gives a plain panel its twelve edges, no more", () => {
    expect(edgeSegments(oc, solidFor(noEdges()), sol.E).segments).toBe(12);
  }, 120000);

  it("keeps the tangent boundary a fillet leaves, which dihedral angle cannot find", () => {
    const cont = fullLengthEdges(sol.env, sol.panels, owners());
    const filleted = edgeSegments(oc, solidFor(applicableEdges(uniformEdges("fillet", 12), cont)), sol.E);
    expect(filleted.segments).toBeGreaterThan(12);
  }, 120000);

  it("hands back positions three floats to a point, two points to a segment", () => {
    const e = edgeSegments(oc, solidFor(noEdges()), sol.E);
    expect(e.positions).toBeInstanceOf(Float32Array);
    expect(e.positions.length).toBe(e.segments * 6);
  }, 120000);

  it("ships the edges alongside the mesh for every panel", () => {
    const meshed = meshPanels(oc, sol.panels, () => ({}), sol.E);
    expect(meshed).toHaveLength(sol.panels.length);
    for (const m of meshed) {
      expect(m.edges.segments).toBe(12);
      expect(m.positions.length).toBeGreaterThan(0);
    }
  }, 120000);
});

describe("§6.2 the projector is calibrated, not guessed", () => {
  it("maps each view's axes as the calibration found them", () => {
    const E = { x: 100, y: 200, z: 400 };
    expect(VIEW_AXES.front.h(7, E)).toBe(7);
    expect(VIEW_AXES.front.v(400, E)).toBe(0);          // z at the top → v = 0
    expect(VIEW_AXES.end.h(0, E)).toBe(200);            // back on the left edge
    expect(VIEW_AXES.plan.v(200, E)).toBe(0);           // back along the top edge
  });
});
