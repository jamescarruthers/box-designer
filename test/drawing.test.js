import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { uniformEdges, noEdges, edgeOwners, fullLengthEdges, applicableEdges } from "../src/model/bevel.js";
import { buildOrthoView, classifyEdges, FACE_SIDE } from "../src/drawing/views.js";
import { buildSection, HATCH } from "../src/drawing/section.js";
import { buildIsometric, isoProject, ISO_Z } from "../src/drawing/iso.js";
import { VIEW_EXTENT } from "../src/drawing/hlr.js";
import { EDGES } from "../src/model/constants.js";

const box = () => solve({
  envelope: { x: 236, y: 286, z: 356 }, thickness: 18, cladding: 6,
  order: ["front", "left", "right", "bottom", "back", "top"],
});

const allViews = (sol, edges) => [
  ...["front", "end", "plan"].map((v) => buildOrthoView(v, sol, edges)),
  buildSection(sol), buildIsometric(sol),
];
const tally = (vs) => ({
  lines: vs.reduce((a, v) => a + v.lines.length, 0),
  arcs: vs.reduce((a, v) => a + v.arcs.length, 0),
});

describe("§9.5 bevel line counts", () => {
  const sol = box();
  // As the sheet draws them: only the edges one panel runs the whole length of.
  const cont = fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
  const cut = (type) => applicableEdges(type === "none" ? noEdges() : uniformEdges(type, 12), cont);
  const CONTINUOUS = 6;

  it("cuts six of the twelve edges on this box", () => {
    expect(Object.values(cont).filter(Boolean)).toHaveLength(CONTINUOUS);
  });
  it("no bevel → 74 lines, 0 arcs", () => {
    expect(tally(allViews(sol, cut("none")))).toEqual({ lines: 74, arcs: 0 });
  });
  it("fillet → 74 lines, one arc per cut edge: arcs without extra lines", () => {
    expect(tally(allViews(sol, cut("fillet")))).toEqual({ lines: 74, arcs: CONTINUOUS });
  });
  it("chamfer → 87 lines, 0 arcs", () => {
    expect(tally(allViews(sol, cut("chamfer")))).toEqual({ lines: 87, arcs: 0 });
  });
  it("a chamfer adds a diagonal per cut edge, plus its tangent lines", () => {
    const plain = tally(allViews(sol, cut("none"))).lines;
    const chamfered = allViews(sol, cut("chamfer"));
    const corners = chamfered.reduce((a, v) => a + v.lines.filter((l) => l.kind === "chamfer-corner").length, 0);
    const tangents = chamfered.reduce((a, v) => a + v.lines.filter((l) => l.kind === "chamfer-tangent").length, 0);
    expect(corners).toBe(CONTINUOUS);
    expect(tally(chamfered).lines).toBe(plain + corners + tangents);
  });
  it("with every edge forced, still adds no line for a fillet", () => {
    // classifyEdges in isolation: twelve corners, twelve arcs, no extra lines.
    expect(tally(allViews(sol, uniformEdges("fillet", 12)))).toEqual({ lines: 74, arcs: 12 });
  });
});

describe("§6.4 edges in the views", () => {
  const sol = box();
  it("makes every edge a corner in exactly one view", () => {
    const per = Object.fromEntries(EDGES.map((k) => [k, 0]));
    for (const v of ["front", "end", "plan"]) {
      const ext = VIEW_EXTENT[v](sol.E);
      for (const c of classifyEdges(v, uniformEdges("fillet", 12), ext).corners) per[c.key]++;
    }
    expect(Object.values(per)).toEqual(Array(12).fill(1));
  });

  it("makes every edge a tangent in the other two views", () => {
    const per = Object.fromEntries(EDGES.map((k) => [k, 0]));
    for (const v of ["front", "end", "plan"]) {
      const ext = VIEW_EXTENT[v](sol.E);
      for (const t of classifyEdges(v, uniformEdges("chamfer", 12), ext).tangents) per[t.key]++;
    }
    expect(Object.values(per)).toEqual(Array(12).fill(2));
  });

  it("gives a fillet no tangent line — it meets the flat face tangentially", () => {
    for (const v of ["front", "end", "plan"]) {
      const built = buildOrthoView(v, sol, uniformEdges("fillet", 12));
      expect(built.lines.filter((l) => l.kind === "chamfer-tangent")).toHaveLength(0);
      expect(built.arcs).toHaveLength(4);
    }
  });

  it("trims the outline back by R at each cut corner", () => {
    const R = 12;
    const plain = buildOrthoView("front", sol, noEdges());
    const filled = buildOrthoView("front", sol, uniformEdges("fillet", R));
    const top = (b) => b.lines.find((l) => l.a[1] === 0 && l.b[1] === 0 && l.kind === "hlr");
    expect(top(plain).a[0]).toBe(0);
    expect(top(plain).b[0]).toBe(sol.E.x);
    expect(top(filled).a[0]).toBe(R);
    expect(top(filled).b[0]).toBe(sol.E.x - R);
  });

  it("sets the sweep flag from dh · dv", () => {
    const built = buildOrthoView("front", sol, uniformEdges("fillet", 12));
    const byKey = Object.fromEntries(built.arcs.map((a) => [a.key, a.sweep]));
    expect(byKey["left|top"]).toBe(0);      // dh +1, dv +1
    expect(byKey["right|top"]).toBe(1);     // dh −1, dv +1
    expect(byKey["left|bottom"]).toBe(1);
    expect(byKey["right|bottom"]).toBe(0);
  });

  it("maps faces to view sides as specified", () => {
    expect(FACE_SIDE.end.back).toEqual(["h", 0]);   // first angle: back on the left edge
    expect(FACE_SIDE.plan.back).toEqual(["v", 0]);  // ...and along the plan's top edge
  });
});

describe("§6.2 first angle", () => {
  const sol = solve({ envelope: { x: 100, y: 200, z: 300 }, thickness: 10,
    order: ["front", "back", "left", "right", "top", "bottom"] });

  it("puts the back of the object on the left edge of the end view", () => {
    const back = sol.panels.find((p) => p.face === "back");
    const r = buildOrthoView("end", sol, noEdges());
    expect(r.ext).toEqual({ h: 200, v: 300 });
    // The back panel occupies y 190..200, which projects to h 0..10.
    expect(back.box.y).toEqual([190, 200]);
    expect(r.lines.some((l) => l.a[0] === 0 && l.b[0] === 0)).toBe(true);
  });

  it("puts the back of the object along the top edge of the plan", () => {
    const r = buildOrthoView("plan", sol, noEdges());
    expect(r.ext).toEqual({ h: 100, v: 200 });
    // Back panel y 190..200 → v 0..10, the top of the plan.
    const seg = r.lines.filter((l) => l.a[1] === 10 && l.b[1] === 10);
    expect(seg.length).toBeGreaterThan(0);
  });
});

describe("§6.5 section A–A", () => {
  const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
    doubler: { front: 18 }, order: ["front", "back", "left", "right", "top", "bottom"] });

  it("omits hidden detail", () => {
    expect(buildSection(sol).lines.every((l) => l.visible)).toBe(true);
  });

  it("hatches each cut panel by layer, opposed for doublers", () => {
    const s = buildSection(sol);
    const layers = new Set(s.hatches.map((h) => h.panel.layer));
    expect(layers.has("shell")).toBe(true);
    expect(layers.has("doubler")).toBe(true);
    expect(HATCH.shell.angle).toBe(45);
    expect(HATCH.doubler.angle).toBe(-45);
    expect(HATCH.cladding.pitch).toBeLessThan(HATCH.shell.pitch);
  });

  it("shows the front doubler, which the front elevation cannot", () => {
    const s = buildSection(sol);
    const doubler = s.hatches.find((h) => h.panel.layer === "doubler");
    expect(doubler).toBeTruthy();
    // 18 mm doubler behind the 18 mm front panel: h from 286−(18+18) to 286−18.
    expect(doubler.h).toEqual([250, 268]);
  });

  it("cuts only the panels the plane passes through", () => {
    const s = buildSection(sol, sol.E.x / 2);
    for (const h of s.hatches) expect(h.panel.box.x[0] < 118 && 118 < h.panel.box.x[1]).toBe(true);
    expect(s.hatches.some((h) => h.panel.face === "left")).toBe(false);
  });

  it("takes a movable cut plane", () => {
    expect(buildSection(sol, 9).cx).toBe(9);
    expect(buildSection(sol, 9).hatches.some((h) => h.panel.face === "left")).toBe(true);
  });
});

describe("§6.6 isometric", () => {
  const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, cladding: { front: 6 },
    order: ["front", "back", "left", "right", "top", "bottom"] });

  it("foreshortens every axis to √(2/3)", () => {
    const o = isoProject({ x: 0, y: 0, z: 0 });
    for (const u of [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }]) {
      const p = isoProject(u);
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeCloseTo(ISO_Z, 12);
    }
  });

  it("shows the joint pattern, including cladding lines, not a bare box", () => {
    const iso = buildIsometric(sol);
    const bare = buildIsometric(solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
      order: ["front", "back", "left", "right", "top", "bottom"] }));
    // The front cladding wraps to the right-hand plane, so its edge shows there.
    expect(iso.lines.length).toBeGreaterThan(bare.lines.length);
    expect(bare.lines.length).toBeGreaterThan(12);
  });

  it("carries no hidden detail", () => {
    expect(buildIsometric(sol).lines.every((l) => l.visible)).toBe(true);
  });

  it("deduplicates shared edges", () => {
    const iso = buildIsometric(sol);
    const keys = iso.lines.map((l) => JSON.stringify([l.a, l.b].sort()));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
