/**
 * §15 Applying a treatment by clicking the edge itself.
 *
 * Two halves, both checkable without a canvas: where the pick targets are, and
 * what a pick does to the design. The renderer only turns the first into meshes
 * and hands the second the key it hit.
 */
import { describe, it, expect } from "vitest";
import {
  edgeProxies, edgeEnds, pickableEdges, pickRadius, hintSize, RUN_INDEX, PICK_MIN, PICK_MAX,
} from "../src/three/edgePick.js";
import { EDGES, edgeAxis, AXIS } from "../src/model/constants.js";
import { DEFAULT_DESIGN, derive, setEdgeTreatment, treatedEdges } from "../src/ui/design.js";
import { toThree } from "../src/three/panelGeometry.js";

const box = derive(DEFAULT_DESIGN);
const { env, E } = box.sol;

describe("§15 where the pick targets are", () => {
  it("puts one on every edge, along the edge's own axis", () => {
    const proxies = edgeProxies(env, E);
    expect(proxies.map((p) => p.key).sort()).toEqual([...EDGES].sort());

    for (const p of proxies) {
      const run = edgeAxis(p.key);
      expect(p.run).toBe(run);
      // Long down the edge, thin the other two ways: the target is the edge,
      // not the corner it ends at.
      const [long, ...across] = [...p.size].sort((a, b) => b - a);
      expect(long).toBeGreaterThan(Math.max(...across) * 3);
      expect(across[0]).toBeCloseTo(across[1], 9);
    }
  });

  it("runs each proxy the full length of its edge, at the corner it names", () => {
    for (const key of EDGES) {
      const [lo, hi] = edgeEnds(env, key);
      const run = edgeAxis(key);
      expect(hi[run] - lo[run]).toBeCloseTo(env[run][1] - env[run][0], 9);

      // The other two coordinates sit on the two faces in the key, on the side
      // that face is: `front|left` is at the front, on the left, and nowhere else.
      for (const face of key.split("|")) {
        const [a, s] = AXIS[face];
        expect(lo[a]).toBe(s < 0 ? env[a][0] : env[a][1]);
        expect(hi[a]).toBe(lo[a]);
      }
    }
  });

  it("centres the proxy on the edge in three's frame", () => {
    for (const p of edgeProxies(env, E)) {
      const [lo, hi] = edgeEnds(env, p.key);
      const mid = ["x", "y", "z"].map((a) => (lo[a] + hi[a]) / 2);
      const expected = toThree(mid, E);
      for (const i of [0, 1, 2]) expect(p.centre[i]).toBeCloseTo(expected[i], 9);
    }
  });

  it("keeps the target hittable on a small box and modest on a large one", () => {
    // A 3 m box would otherwise want a 130 mm target, which swallows the corner;
    // a 60 mm one would want under 3 mm, which is unhittable.
    expect(pickRadius({ x: 3000, y: 3000, z: 3000 })).toBe(PICK_MAX);
    expect(pickRadius({ x: 60, y: 60, z: 60 })).toBe(PICK_MIN);
    const mid = pickRadius({ x: 400, y: 400, z: 400 });
    expect(mid).toBeGreaterThan(PICK_MIN);
    expect(mid).toBeLessThan(PICK_MAX);
  });
});

describe("§15 the highlight on the edge under the pointer", () => {
  it("keeps the bar the length of the edge and slims it across", () => {
    const r = pickRadius(E);
    for (const p of edgeProxies(env, E, r)) {
      const size = hintSize(p, r);
      const along = RUN_INDEX[p.run];
      expect(size[along]).toBe(p.size[along]);
      for (const i of [0, 1, 2]) {
        if (i === along) continue;
        expect(size[i]).toBeLessThan(p.size[i]);
        expect(size[i]).toBeGreaterThan(0);
      }
    }
  });

  it("gives the bar width, because a line has none to give", () => {
    // Drawn as a line it was one pixel wide — WebGL ignores `linewidth` — and it
    // landed exactly on the panel edges already drawn there. Photographed in the
    // browser: nothing visible at all. The bar has to be thick enough to see.
    const r = pickRadius(E);
    const [p] = edgeProxies(env, E, r);
    const across = hintSize(p, r).filter((_, i) => i !== RUN_INDEX[p.run]);
    for (const a of across) expect(a).toBeGreaterThan(2);
  });
});

describe("§15 which edges a tool may pick", () => {
  it("offers a bevel only where one panel runs the whole edge", () => {
    for (const tool of ["chamfer", "fillet"]) {
      const ok = pickableEdges(tool, box);
      for (const key of EDGES) expect(ok[key].ok, `${tool} ${key}`).toBe(!!box.fullLength[key]);
      const blocked = EDGES.find((k) => !ok[k].ok);
      expect(ok[blocked].why).toMatch(/whole of this edge/);
    }
  });

  it("offers a mitre only where the two panels meet along the edge", () => {
    const ok = pickableEdges("mitre", box);
    for (const key of EDGES) expect(ok[key].ok, key).toBe(!!box.mitrable[key].ok);
    // The two questions are genuinely different: this box has edges one panel
    // runs the whole of that still cannot be mitred, so neither answer would do
    // for both tools.
    expect(EDGES.some((k) => box.fullLength[k] && !box.mitrable[k].ok)).toBe(true);
  });

  it("lets Square reach every edge, including the ones nothing else can treat", () => {
    const ok = pickableEdges("none", box);
    expect(EDGES.every((k) => ok[k].ok)).toBe(true);
  });
});

describe("§15 what a pick does to the design", () => {
  it("treats the edge that was clicked and no other", () => {
    const after = setEdgeTreatment(DEFAULT_DESIGN, "front|left", "fillet", 8);
    expect(after.edge.perEdge).toBe(true);
    expect(treatedEdges(after)).toEqual([["front|left", { type: "fillet", radius: 8 }]]);
  });

  it("keeps the other eleven when a uniform box has one edge squared", () => {
    const all = { ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, type: "fillet", radius: 12 } };
    expect(treatedEdges(all)).toHaveLength(12);

    const after = setEdgeTreatment(all, "front|left", "none");
    const left = treatedEdges(after);
    expect(left).toHaveLength(11);
    expect(left.map(([k]) => k)).not.toContain("front|left");
    // Squaring one edge is not a reason to lose the fillet on the rest — which
    // is exactly what seeding per-edge mode from nothing would have done.
    expect(left.every(([, v]) => v.type === "fillet" && v.radius === 12)).toBe(true);
  });

  it("carries the edge's own radius through a change of type", () => {
    let d = setEdgeTreatment(DEFAULT_DESIGN, "front|left", "fillet", 20);
    d = setEdgeTreatment(d, "front|left", "chamfer");
    expect(d.edge.by["front|left"]).toEqual({ type: "chamfer", radius: 20 });
  });

  it("lists nothing for a square box, per-edge or not", () => {
    expect(treatedEdges(DEFAULT_DESIGN)).toEqual([]);
    expect(treatedEdges({ ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, perEdge: true } })).toEqual([]);
    // And a square entry left behind by an older save is not a treatment either.
    const stale = { ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, perEdge: true, by: { "front|left": { type: "none", radius: 12 } } } };
    expect(treatedEdges(stale)).toEqual([]);
  });

  it("reaches the same solve a hand-built per-edge design does", () => {
    const clicked = setEdgeTreatment(DEFAULT_DESIGN, "front|left", "mitre");
    const built = { ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, perEdge: true, by: { "front|left": { type: "mitre", radius: 12 } } } };
    const size = (d) => derive(d).rows.map((r) => [r.id, r.length, r.width, r.edgeWork]);
    expect(size(clicked)).toEqual(size(built));
    // And it is a mitre that actually got cut, not one that was asked for and
    // quietly refused.
    expect(derive(clicked).rows.some((r) => r.edgeWork.includes("45°"))).toBe(true);
  });
});
