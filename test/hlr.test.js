import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { viewLines, mergeRuns, hiddenLineRemoval } from "../src/drawing/hlr.js";

const fmt = (s) => `${s.visible ? "solid " : "dashed"} ${s.orient === "h" ? "horiz" : "vert "} ${s.fixed} ${s.a}..${s.b}`;

describe("§6.3 hidden line removal", () => {
  // 236 × 286 × 356 carcass, 18 mm, front and back wrapping.
  const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
    order: ["front", "back", "left", "right", "top", "bottom"] });

  it("reproduces the verified end view exactly", () => {
    expect(viewLines(sol.panels, "end", sol.E).map(fmt)).toEqual([
      "solid  horiz 0 0..286",     // outline top
      "dashed horiz 18 18..268",   // top panel, inner face
      "dashed horiz 338 18..268",  // bottom panel, inner face
      "solid  horiz 356 0..286",   // outline bottom
      "solid  vert  0 0..356",     // outline back
      "solid  vert  18 0..356",    // back panel, inner face
      "solid  vert  268 0..356",   // front panel, inner face
      "solid  vert  286 0..356",   // outline front
    ]);
  });

  it("draws the visible line where a hidden one coincides with it", () => {
    const lines = viewLines(sol.panels, "end", sol.E);
    // The bottom panel's outline sits precisely under the top panel's.
    expect(lines.filter((s) => s.fixed === 0 && s.orient === "h")).toHaveLength(1);
    expect(lines.filter((s) => s.fixed === 0 && s.orient === "h")[0].visible).toBe(true);
  });

  it("keeps a plan sparse — a correct drawing carries almost no dashed line", () => {
    const lines = viewLines(sol.panels, "plan", sol.E);
    expect(lines.filter((s) => !s.visible)).toHaveLength(0);
  });

  it("merges an outline assembled from four panels into four segments", () => {
    // Sides wrap: no single panel spans the front elevation outline.
    const s2 = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
      order: ["left", "right", "top", "bottom", "front", "back"] });
    const lines = viewLines(s2.panels, "front", s2.E);
    const outline = lines.filter((s) =>
      (s.orient === "h" && (s.fixed === 0 || s.fixed === 356)) ||
      (s.orient === "v" && (s.fixed === 0 || s.fixed === 236)));
    expect(outline).toHaveLength(4);
    for (const s of outline) {
      expect(s.visible).toBe(true);
      expect(s.b - s.a).toBe(s.orient === "h" ? 236 : 356);
    }
  });

  it("treats a segment lying on a nearer rectangle's boundary as a visible joint", () => {
    // Strict containment on both counts: touching a nearer rectangle is not hiding.
    const lines = hiddenLineRemoval([
      { h: [0, 10], v: [0, 10], n: 0 },
      { h: [10, 20], v: [0, 10], n: 1 },
    ]);
    expect(lines.filter((s) => s.orient === "v" && s.fixed === 10)).toEqual([
      { orient: "v", fixed: 10, a: 0, b: 10, visible: true },
    ]);
  });

  it("keeps the joints between abutting near panels visible", () => {
    const clad = solve({ envelope: { x: 200, y: 200, z: 200 }, thickness: 18, cladding: 6,
      order: ["front", "back", "left", "right", "top", "bottom"] });
    const lines = viewLines(clad.panels, "end", clad.E);
    // Back cladding meets left cladding at h = 6; both are at n = 0, so neither hides it.
    expect(lines.some((s) => s.orient === "v" && s.fixed === 6 && s.visible)).toBe(true);
    // The shell behind the cladding is hidden.
    expect(lines.some((s) => s.orient === "v" && s.fixed === 24 && !s.visible)).toBe(true);
  });

  it("merges touching runs and keeps differing visibilities apart", () => {
    expect(mergeRuns([
      { orient: "h", fixed: 0, a: 0, b: 10, visible: true },
      { orient: "h", fixed: 0, a: 10, b: 20, visible: true },
      { orient: "h", fixed: 0, a: 20, b: 30, visible: false },
    ])).toEqual([
      { orient: "h", fixed: 0, a: 0, b: 20, visible: true },
      { orient: "h", fixed: 0, a: 20, b: 30, visible: false },
    ]);
  });
});
