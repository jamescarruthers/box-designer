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
import { solve, boxVolume } from "../src/model/solver.js";
import {
  noEdges, uniformEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels,
} from "../src/model/bevel.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";
import { assembly, volumeOf, panelSolid, edgesOf, edgeMidpoint, cutFittings, portTube } from "../src/occt/solids.js";
import { applyMitres, mitreBevels, mitreLoss } from "../src/model/mitre.js";
import { newFitting, fittingOwners, portOuterRadius } from "../src/model/fittings.js";
import { viewGeometry, hiddenLineRemoval, isoGeometry, VIEW_AXES, ISO_VIEW } from "../src/occt/hlr.js";
import { kernelViews } from "../src/occt/drawing.js";
import { OPS } from "../src/occt/worker.js";
import { buildIsometric } from "../src/drawing/iso.js";
import { mergeViewLines, describe as describeLines } from "../src/occt/merge.js";
import { triangulate, meshPanels, meshVolume, describeShapeFailure } from "../src/occt/mesh.js";
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

const facesOf = (shape) => {
  let n = 0;
  const e = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while (e.More()) { n++; e.Next(); }
  return n;
};

describe("§10 fittings, cut for real", () => {
  const sol = carcass();
  const panel = () => fittingOwners(sol.panels, ["front"]).front;
  const vol = (shape) => volumeOf(oc, shape);
  const solid = (fittings) => panelSolid(oc, panel(), {}, fittings);

  it("removes exactly the cylinder a driver's cutout describes", () => {
    const p = panel();
    const t = p.box.y[1] - p.box.y[0];
    const f = { ...newFitting("driver", "front", { a: 118, b: 240 }), bolts: 0 };
    const removed = vol(solid([])) - vol(solid([f]));
    expect(removed).toBeCloseTo(Math.PI * (f.cutout / 2) ** 2 * t, 3);
  }, 120000);

  it("removes the bolt holes as well as the cutout", () => {
    const p = panel();
    const t = p.box.y[1] - p.box.y[0];
    const f = newFitting("driver", "front", { a: 118, b: 240 });
    const removed = vol(solid([])) - vol(solid([f]));
    const expected = Math.PI * t * ((f.cutout / 2) ** 2 + f.bolts * (f.boltHole / 2) ** 2);
    expect(removed).toBeCloseTo(expected, 3);
  }, 120000);

  it("cuts a port as a single bore", () => {
    const p = panel();
    const t = p.box.y[1] - p.box.y[0];
    const f = newFitting("port", "front", { a: 118, b: 100 });
    expect(vol(solid([])) - vol(solid([f]))).toBeCloseTo(Math.PI * (f.diameter / 2) ** 2 * t, 3);
  }, 120000);

  it("leaves the panel one solid, with a cylindrical wall per hole", () => {
    const f = { ...newFitting("driver", "front", { a: 118, b: 240 }), bolts: 3 };
    const before = facesOf(solid([])), after = facesOf(solid([f]));
    expect(before).toBe(6);
    expect(after).toBe(6 + 4);        // one cylindrical wall for the cutout and each bolt
  }, 120000);

  it("makes a port tube an annulus of the right volume", () => {
    const f = newFitting("port", "front", { a: 118, b: 100 });
    const t = portTube(oc, panel(), f);
    const expected = Math.PI * f.length * (portOuterRadius(f) ** 2 - (f.diameter / 2) ** 2);
    expect(vol(t)).toBeCloseTo(expected, 3);
  }, 120000);

  it("stands the tube off the panel's inner face, into the cavity", () => {
    const p = panel();
    const f = newFitting("port", "front", { a: 118, b: 100 });
    const box = new oc.Bnd_Box_1();
    oc.BRepBndLib.Add(portTube(oc, p, f), box, true);
    // The front panel's inner face is at y = box.y[1]; the tube runs from there back.
    expect(box.CornerMin().Y()).toBeCloseTo(p.box.y[1], 3);
    expect(box.CornerMax().Y()).toBeCloseTo(p.box.y[1] + f.length, 3);
  }, 120000);

  it("cuts nothing when there are no fittings", () => {
    expect(vol(cutFittings(oc, panelSolid(oc, panel(), {}), panel(), []))).toBeCloseTo(vol(solid([])), 6);
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

  /**
   * §4.4 The mesh must be closed and consistently wound, and the way to know is
   * its own volume — not "does every normal point away from the centroid".
   *
   * That was the test, and it was the bug. It holds only on a convex solid, and
   * a panel stopped being one the moment §10 bored a hole through it: the wall
   * of a bore faces inward, at the axis of the hole, so the check flipped every
   * triangle on it. The hole had no inside. You looked through the panel and saw
   * nothing, because the only surface there pointed away and was culled.
   */
  it("§4.4 winds every face so the mesh encloses the volume the kernel says", () => {
    const cont = fullLengthEdges(sol.env, sol.panels, owners());
    const filleted = applicableEdges(uniformEdges("fillet", 12), cont);
    const front = fittingOwners(sol.panels, ["front"]).front;
    const i = sol.panels.indexOf(front);
    const driver = newFitting("driver", "front", { a: 118, b: 240 });

    const cases = [
      ["plain", noEdges(), []],
      ["filleted", filleted, []],
      ["bored", noEdges(), [driver]],
      ["bored and filleted", filleted, [driver]],
    ];
    for (const [what, edges, fittings] of cases) {
      const shape = panelSolid(oc, front, panelBevels(i, front, edges, owners()), fittings);
      const mesh = meshVolume(triangulate(oc, shape, sol.E).positions);
      // Positive: inside out and it would come back negative.
      expect(mesh, what).toBeGreaterThan(0);
      // And within the chord height of the real thing.
      expect(Math.abs(mesh - volumeOf(oc, shape)) / mesh, what).toBeLessThan(0.005);
    }
  }, 180000);

  it("§4.4 keeps a convex panel entirely outward-facing, which it still should be", () => {
    const [m] = meshPanels(oc, sol.panels.slice(0, 1), () => ({}), sol.E);
    expect(inwardCount(m.positions, m.centroid)).toBe(0);
  }, 120000);

  it("§4.4 turns a bore's wall inward, which is what gives the hole an inside", () => {
    const front = fittingOwners(sol.panels, ["front"]).front;
    const driver = newFitting("driver", "front", { a: 118, b: 240 });
    const shape = panelSolid(oc, front, {}, [driver]);
    const m = triangulate(oc, shape, sol.E);
    expect(inwardCount(m.positions, m.centroid)).toBeGreaterThan(0);
    expect(m.reversed).toBeGreaterThan(0);   // OCCT hands back both orientations
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

describe("§12 mitres, cut for real", () => {
  const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
  const mitredCarcass = (keys = VERTICALS) => {
    const sol = carcass();
    const { panels } = applyMitres(sol.panels, sol.env, Object.fromEntries(keys.map((k) => [k, true])));
    return { ...sol, panels };
  };

  it("removes exactly the triangular prism the arithmetic says it does", () => {
    const sol = mitredCarcass();
    for (const p of sol.panels) {
      const want = boxVolume(p.box) - mitreLoss(p);
      expect(volumeOf(oc, panelSolid(oc, p, mitreBevels(p)))).toBeCloseTo(want, 6);
    }
  }, 120000);

  it("closes on volume against the kernel, mitres and all", () => {
    const sol = mitredCarcass();
    const shape = assembly(oc, sol.panels, (i, p) => mitreBevels(p));
    const solid = sol.panels.reduce((a, p) => a + boxVolume(p.box) - mitreLoss(p), 0);
    expect(volumeOf(oc, shape)).toBeCloseTo(solid, 3);
    expect(solid + boxVolume(sol.cavity)).toBeCloseTo(sol.envVolume, 6);
  }, 120000);

  it("cuts a mitre and a decorative bevel on the same panel without disturbing either", () => {
    const sol = mitredCarcass(["front|left"]);
    const front = sol.panels.find((p) => p.face === "front");
    const bevels = { ...mitreBevels(front), top: { type: "chamfer", radius: 6 } };
    const both = volumeOf(oc, panelSolid(oc, front, bevels));
    const mitreOnly = volumeOf(oc, panelSolid(oc, front, mitreBevels(front)));
    // A chamfer takes R²/2 per millimetre of run — but the mitred end is no
    // longer square, so at depth d into the panel the material starts R... at d,
    // and the wedge is short by ∫(R−d)·d dd = R³/6.
    const R = 6, run = front.box.x[1] - front.box.x[0];
    expect(mitreOnly - both).toBeCloseTo((R * R / 2) * run - (R ** 3) / 6, 3);
  }, 120000);

  it("keeps the outer surface: the mitred panel still reaches the envelope corner", () => {
    const sol = mitredCarcass(["front|left"]);
    const left = sol.panels.find((p) => p.face === "left");
    const shape = panelSolid(oc, left, mitreBevels(left));
    const pts = edgesOf(oc, shape).map((e) => edgeMidpoint(oc, e).point);
    // Its outer face is x = 0 and it now runs to y = 0, the front of the envelope.
    expect(pts.some((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6)).toBe(true);
  }, 120000);
});


/**
 * §11 The whole drawing job, as the worker runs it.
 *
 * `kernelViews` had no test and had been throwing a ReferenceError on every
 * call — an `opts` that was never declared — so switching the drawing to the
 * kernel failed outright and quietly fell back. A function the app depends on
 * entirely needs at least one test that calls it.
 */
describe("§11 the drawing job the worker runs", () => {
  const job = (extra = {}) => {
    const sol = carcass();
    const owners = edgeOwners(sol.env, sol.panels);
    const edges = applicableEdges(uniformEdges("chamfer", 6), fullLengthEdges(sol.env, sol.panels, owners));
    return { sol, edges, owners, ...extra };
  };

  it("builds all five views without throwing", () => {
    const { sol, edges, owners } = job();
    const { geometry } = kernelViews(oc, sol, edges, owners, {});
    expect(Object.keys(geometry).sort()).toEqual(["end", "front", "iso", "plan", "section"]);
    for (const view of ["front", "end", "plan", "iso"]) {
      expect(geometry[view].lines.length).toBeGreaterThan(0);
    }
  }, 180000);

  it("cuts the fittings it is given, by panel index", () => {
    const { sol, edges, owners } = job();
    const driver = newFitting("driver", "front", { a: 118, b: 240 });
    const panels = fittingOwners(sol.panels, ["front"]);
    const fittings = sol.panels.map((p) => (panels.front === p ? [driver] : []));
    const plain = kernelViews(oc, sol, edges, owners, {}).geometry;
    const holed = kernelViews(oc, sol, edges, owners, { fittingsFor: (i) => fittings[i] }).geometry;
    expect(holed.front.lines.length).toBeGreaterThan(plain.front.lines.length);
  }, 180000);

  it("draws a bore without labouring over it", () => {
    // A driver cut into a panel appeared for a while to cost minutes of hidden
    // line removal. It costs nothing to speak of; what cost minutes was a
    // fitting with no position, boring at NaN. See tools/spike/hlr-holes.mjs.
    const { sol, edges, owners } = job();
    const driver = newFitting("driver", "front", { a: 118, b: 240 });
    const panels = fittingOwners(sol.panels, ["front"]);
    const fittings = sol.panels.map((p) => (panels.front === p ? [driver] : []));
    const t0 = Date.now();
    kernelViews(oc, sol, edges, owners, { fittingsFor: (i) => fittings[i] });
    expect(Date.now() - t0).toBeLessThan(20_000);
  }, 60000);

  it("returns only what can cross a worker boundary", () => {
    const { sol, edges, owners } = job();
    const geometry = OPS.views(oc, { sol, edges, owners, sectionAt: sol.E.x / 2, fittings: [] });
    expect(() => structuredClone(geometry)).not.toThrow();
  }, 180000);

  it("meshes through the same door the worker uses", () => {
    const sol = carcass();
    const owners = edgeOwners(sol.env, sol.panels);
    const meshes = OPS.mesh(oc, {
      panels: sol.panels,
      bevels: sol.panels.map((p, i) => panelBevels(i, p, noEdges(), owners)),
      fittings: [],
      E: sol.E,
    });
    expect(meshes).toHaveLength(sol.panels.length);
    expect(meshes.every((m) => m.positions.length > 0)).toBe(true);
  }, 180000);
});

/**
 * §25 One panel's failure is one panel's failure.
 *
 * Reported as "working: 7210856 — showing the ring-stack solids": OCCT refused
 * a shape, threw, and the whole box went with it — six panels replaced by a
 * sentence because one edge on one of them could not be cut. And the sentence
 * was a pointer, because Emscripten throws a C++ exception as the bare address
 * of it and this build has no helper compiled in to read the text back out.
 */
describe("§25 a panel the kernel will not build", () => {
  const sol = carcass();
  const edges = uniformEdges("fillet", 6);
  const owners = edgeOwners(sol.env, sol.panels);
  const bevels = (i, p) => panelBevels(i, p, edges, owners);

  it("loses that panel and no other", () => {
    // The third panel throws the way OCCT throws: a bare number.
    const meshes = meshPanels(oc, sol.panels, (i, p) => {
      if (i === 2) { throw 7210856; }                    // eslint-disable-line no-throw-literal
      return bevels(i, p);
    }, sol.E);

    expect(meshes).toHaveLength(sol.panels.length);
    expect(meshes[2].failed).toBeTruthy();
    expect(meshes[2].positions).toBeUndefined();
    expect(meshes[2].face).toBe(sol.panels[2].face);
    // Every other panel is the kernel's own work, not a casualty.
    for (const [i, m] of meshes.entries()) {
      if (i === 2) continue;
      expect(m.failed, `panel ${i}`).toBeUndefined();
      expect(m.positions.length, `panel ${i}`).toBeGreaterThan(0);
      expect(m.triangles, `panel ${i}`).toBeGreaterThan(0);
    }
  });

  it("says something a person can read, not an address", () => {
    // The whole of the reported symptom: a number with no message on it.
    expect(describeShapeFailure(7210856)).toMatch(/geometry engine/);
    expect(describeShapeFailure(7210856)).not.toMatch(/7210856/);
    // Anything that is a real error keeps what it said.
    expect(describeShapeFailure(new Error("boolean failed on the front"))).toBe("boolean failed on the front");
    expect(describeShapeFailure(undefined)).toMatch(/geometry engine/);
  });

  it("leaves the views something to fall back to", () => {
    // §4 The viewport reads `solids[i].positions` and draws the analytic ring
    // stack when there is none, so a marked panel is drawn the approximate way
    // rather than not drawn — which is what makes losing one survivable.
    const meshes = meshPanels(oc, sol.panels, (i, p) => {
      if (i === 0) { throw 7210856; }                    // eslint-disable-line no-throw-literal
      return bevels(i, p);
    }, sol.E);
    const positions = meshes[0]?.positions
      ?? panelPositions(sol.panels[0], bevels(0, sol.panels[0]), sol.E).positions;
    expect(positions.length).toBeGreaterThan(0);
  });
});
