import { describe, it, expect } from "vitest";
import { solve, panelBlank } from "../src/model/solver.js";
import { uniformEdges, edgeOwners, panelBevels, insetAt, bevelDepths } from "../src/model/bevel.js";
import { panelSolid, panelPositions, inwardCount, ringAt, toThree, explodeOffset, panelEdgeLoops } from "../src/three/panelGeometry.js";
import { EDGES } from "../src/model/constants.js";

const R = 12;
const box = () => solve({ envelope: { x: 300, y: 240, z: 400 }, thickness: 18,
  order: ["front", "back", "left", "right", "top", "bottom"] });

// Sides wrap, so the left panel is rank 0 and owns all four of its edges.
function sidePanel(type) {
  const sol = solve({ envelope: { x: 300, y: 240, z: 400 }, thickness: 18,
    order: ["left", "right", "top", "bottom", "front", "back"] });
  const edges = uniformEdges(type, R);
  const owners = edgeOwners(sol.env, sol.panels);
  const i = sol.panels.findIndex((p) => p.face === "left");
  return { sol, panel: sol.panels[i], bevels: panelBevels(i, sol.panels[i], edges, owners), E: sol.E };
}

describe("§3 bevel profile", () => {
  it.each(["chamfer", "fillet"])("%s gives inset(0) = R and inset(R) = 0", (type) => {
    expect(insetAt(type, R, 0)).toBeCloseTo(R, 12);
    expect(insetAt(type, R, R)).toBeCloseTo(0, 12);
  });

  it("a fillet bulges outside the chamfer between the ends", () => {
    for (const d of [2, 4, 6, 8, 10])
      expect(insetAt("fillet", R, d)).toBeLessThan(insetAt("chamfer", R, d));
  });

  it("samples one step for a chamfer and eight for a fillet", () => {
    expect(bevelDepths("chamfer", R)).toHaveLength(2);
    expect(bevelDepths("fillet", R)).toHaveLength(9);
    expect(bevelDepths("none", R)).toEqual([0]);
  });

  it("attaches an edge to exactly one panel, and to the cladding when clad", () => {
    const plain = box();
    const owners = edgeOwners(plain.env, plain.panels);
    expect(Object.keys(owners)).toHaveLength(12);

    const clad = solve({ envelope: { x: 300, y: 240, z: 400 }, thickness: 18, cladding: { front: 6 },
      order: ["front", "back", "left", "right", "top", "bottom"] });
    const cladOwners = edgeOwners(clad.env, clad.panels);
    for (const key of EDGES.filter((k) => k.startsWith("front|") || k.includes("|front"))) {
      const owner = clad.panels[cladOwners[key]];
      expect(owner.layer).toBe("cladding");
      expect(owner.face).toBe("front");
    }
  });
});

describe("§9.3 triangle orientation", () => {
  it("points every triangle of a filleted side panel away from its centroid", () => {
    const { panel, bevels, E } = sidePanel("fillet");
    expect(Object.keys(bevels).sort()).toEqual(["back", "bottom", "front", "top"]);
    const { positions, triangles, centroid } = panelPositions(panel, bevels, E);
    expect(triangles).toBe(76);                 // 8 fillet steps + final ring, lofted and capped
    expect(inwardCount(positions, centroid)).toBe(0);
  });

  it.each(["chamfer", "fillet"])("%s: bevel is at the outer face, not in the cavity", () => {
    const { panel, bevels } = sidePanel("fillet");
    const outer = ringAt(panel, bevels, 0);
    const inner = ringAt(panel, bevels, 18);
    expect(panel.box.y[1] - panel.box.y[0] - (outer.y[1] - outer.y[0])).toBeCloseTo(2 * R, 9);
    expect(panel.box.z[1] - panel.box.z[0] - (outer.z[1] - outer.z[0])).toBeCloseTo(2 * R, 9);
    expect(inner.y[1] - inner.y[0]).toBeCloseTo(panel.box.y[1] - panel.box.y[0], 9);
    expect(inner.z[1] - inner.z[0]).toBeCloseTo(panel.box.z[1] - panel.box.z[0], 9);
  });

  it("leaves an unbevelled panel a plain six-sided prism", () => {
    const { panel } = sidePanel("none");
    const { verts, tris } = panelSolid(panel, {});
    expect(verts).toHaveLength(8);
    expect(tris).toHaveLength(12);
  });

  it("does not change the blank size", () => {
    const before = sidePanel("none").sol.panels.map((p) => panelBlank(p));
    expect(sidePanel("fillet").sol.panels.map((p) => panelBlank(p))).toEqual(before);
    expect(sidePanel("chamfer").sol.panels.map((p) => panelBlank(p))).toEqual(before);
  });
});

describe("§4 the edges a fillet leaves behind", () => {
  // EdgesGeometry finds creases by dihedral angle, so it cannot see where a
  // fillet runs tangentially into the flat face it was cut from. Without these
  // loops the wireframe has a hole at every round-over and the offset face has
  // no outline at all.
  const loops = (type) => {
    const { panel, bevels, E } = sidePanel(type);
    return { positions: panelEdgeLoops(panel, bevels, E), panel, bevels };
  };
  const segmentsOf = (positions) => positions.length / 6;

  it("draws the outer and inner faces of a square panel, and nothing else", () => {
    expect(segmentsOf(loops("none").positions)).toBe(8);      // two loops of four
  });

  it("adds the depth at which the bevel becomes tangent to its side", () => {
    expect(segmentsOf(loops("fillet").positions)).toBe(12);   // outer, tangent, inner
    expect(segmentsOf(loops("chamfer").positions)).toBe(12);
  });

  it("insets the outer loop by R and leaves the inner one full size", () => {
    const { panel, bevels } = loops("fillet");
    const outer = ringAt(panel, bevels, 0);
    expect(panel.box.z[1] - panel.box.z[0] - (outer.z[1] - outer.z[0])).toBeCloseTo(2 * R, 9);
    const tangent = ringAt(panel, bevels, R);
    expect(tangent.z).toEqual(panel.box.z);
  });

  it("collapses to two loops when the radius fills the thickness", () => {
    const sol = solve({ envelope: { x: 300, y: 240, z: 400 }, thickness: 18,
      order: ["left", "right", "top", "bottom", "front", "back"] });
    const owners = edgeOwners(sol.env, sol.panels);
    const i = sol.panels.findIndex((p) => p.face === "left");
    const edges = uniformEdges("fillet", 18);   // exactly the panel thickness
    const positions = panelEdgeLoops(sol.panels[i], panelBevels(i, sol.panels[i], edges, owners), sol.E);
    expect(segmentsOf(positions)).toBe(8);      // the tangent depth is the inner face
  });
});

describe("§4.3 the model → three transform is a rotation", () => {
  const E = { x: 10, y: 20, z: 30 };
  it("has determinant +1", () => {
    const o = toThree([0, 0, 0], { x: 0, y: 0, z: 0 });
    const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => toThree(v, { x: 0, y: 0, z: 0 }).map((c, i) => c - o[i]));
    const [a, b, c] = cols;
    const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    expect(det).toBeCloseTo(1, 12);
  });

  it("centres the envelope on the origin", () => {
    toThree([E.x / 2, E.y / 2, E.z / 2], E).forEach((c) => expect(c).toBeCloseTo(0, 12));
  });

  it("flips the sign on depth when exploding", () => {
    expect(explodeOffset({ face: "front", layer: "shell" }, 10)).toEqual([0, 0, 10]);
    expect(explodeOffset({ face: "back", layer: "shell" }, 10)).toEqual([0, 0, -10]);
    expect(explodeOffset({ face: "top", layer: "cladding" }, 10)).toEqual([0, 15, 0]);
    expect(explodeOffset({ face: "left", layer: "doubler" }, 10)).toEqual([-4.5, 0, 0]);
  });
});
