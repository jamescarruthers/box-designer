import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { noEdges, uniformEdges } from "../src/model/bevel.js";
import { buildSheet, layout, pickScale, scaleLabel, edgeNote, SHEET, TITLE_BLOCK, LW, TS, PREFERRED_SCALES, GAP_H, GAP_V, frameRect } from "../src/drawing/sheet.js";

const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, doubler: { front: 18 },
  order: ["front", "back", "left", "right", "top", "bottom"] });

describe("§6.1 the sheet", () => {
  it("is A3 landscape with a 20 mm filing margin", () => {
    expect([SHEET.w, SHEET.h]).toEqual([420, 297]);
    expect(SHEET.w / SHEET.h).toBeCloseTo(Math.SQRT2, 2);
    const f = frameRect();
    expect(f.x).toBe(20);
    expect(f.y).toBe(10);
    expect(f.w).toBe(390);
    expect(f.h).toBe(277);
  });

  it("puts a 180 × 40 title block in the bottom-right of the frame", () => {
    expect([TITLE_BLOCK.w, TITLE_BLOCK.h]).toEqual([180, 40]);
    const svg = buildSheet(sol, noEdges()).svg;
    expect(svg).toContain(`x="230" y="247" width="180" height="40"`);
  });

  it("picks a real ISO 5455 scale, never a fit", () => {
    for (const E of [{ x: 236, y: 286, z: 356 }, { x: 60, y: 75, z: 96 }, { x: 1800, y: 900, z: 2100 }]) {
      const L = layout(E);
      expect(PREFERRED_SCALES).toContain(L.scale);
    }
  });

  it("shrinks the scale as the box grows, instead of rescaling silently", () => {
    const small = layout({ x: 236, y: 286, z: 356 }).scale;
    const big = layout({ x: 2360, y: 2860, z: 3560 }).scale;
    expect(big).toBeLessThan(small);
  });

  it("keeps the block inside the frame with the minimum gaps", () => {
    for (const E of [{ x: 236, y: 286, z: 356 }, { x: 900, y: 400, z: 500 }, { x: 120, y: 150, z: 190 }]) {
      const L = layout(E);
      const avail = { w: L.frame.w, h: L.frame.h - TITLE_BLOCK.h };
      expect(L.scale * (E.x + 2 * E.y) + 2 * GAP_H[0]).toBeLessThanOrEqual(avail.w + 1e-9);
      expect(L.scale * (E.z + E.y) + GAP_V[0]).toBeLessThanOrEqual(avail.h + 1e-9);
      expect(L.gapH).toBeGreaterThanOrEqual(GAP_H[0] - 1e-9);
      expect(L.gapH).toBeLessThanOrEqual(GAP_H[1] + 1e-9);
      expect(L.gapV).toBeGreaterThanOrEqual(GAP_V[0] - 1e-9);
      expect(L.gapV).toBeLessThanOrEqual(GAP_V[1] + 1e-9);
      for (const c of Object.values(L.cells)) {
        expect(c.x).toBeGreaterThanOrEqual(L.frame.x - 1e-9);
        expect(c.x + c.w).toBeLessThanOrEqual(L.frame.x + L.frame.w + 1e-9);
      }
    }
  });

  it("arranges columns W, D, D and rows H, D", () => {
    const E = { x: 236, y: 286, z: 356 };
    const L = layout(E);
    expect(L.cells.front.w).toBeCloseTo(E.x * L.scale, 9);
    expect(L.cells.end.w).toBeCloseTo(E.y * L.scale, 9);
    expect(L.cells.section.w).toBeCloseTo(E.y * L.scale, 9);
    expect(L.cells.front.h).toBeCloseTo(E.z * L.scale, 9);
    expect(L.cells.plan.h).toBeCloseTo(E.y * L.scale, 9);
    expect(L.cells.plan.y).toBeGreaterThan(L.cells.front.y + L.cells.front.h);
    expect(L.cells.end.x).toBeGreaterThan(L.cells.front.x + L.cells.front.w);
  });

  it("labels the scale in the title block", () => {
    expect(scaleLabel(1)).toBe("1:1");
    expect(scaleLabel(0.2)).toBe("1:5");
    expect(scaleLabel(2)).toBe("2:1");
    expect(buildSheet(sol, noEdges()).svg).toContain(">1:5<");
  });

  it("uses the specified line widths and text sizes", () => {
    expect(LW).toEqual({ visible: 0.7, hidden: 0.45, dim: 0.25, cut: 0.45, frame: 0.7, hatch: 0.16 });
    expect(TS).toEqual({ dim: 3.2, label: 2.9, value: 4, key: 2.2, note: 2.4 });
    const svg = buildSheet(sol, noEdges()).svg;
    expect(svg).toContain(`stroke-width="0.7"`);
    expect(svg).toContain(`stroke-dasharray="3 1.4"`);
  });
});

describe("§6 the drawing as a whole", () => {
  const built = buildSheet(sol, uniformEdges("fillet", 12), { title: "TEST BOX" });

  it("draws all five views", () => {
    for (const v of ["front", "end", "plan", "section", "iso"])
      expect(built.svg).toContain(`data-view="${v}"`);
    for (const t of ["FRONT ELEVATION", "END VIEW FROM LEFT", "SECTION A", "PLAN FROM ABOVE", "ISOMETRIC"])
      expect(built.svg).toContain(t);
  });

  it("escapes text and keeps the en dash intact", () => {
    expect(buildSheet(sol, noEdges(), { title: 'A & B "big" <box>' }).svg)
      .toContain("A &amp; B &quot;big&quot; &lt;box&gt;");
    expect(built.svg).toContain("SECTION A–A");
  });

  it("carries the sheet note and the edge note", () => {
    expect(built.svg).toContain("ALL DIMENSIONS IN MILLIMETRES");
    expect(built.svg).toContain("ALL EXTERNAL EDGES R12");
  });

  it("labels the isometric only when its scale differs from the sheet's", () => {
    expect(built.isoScale).not.toBe(built.scale);
    expect(built.svg).toContain(`SCALE ${scaleLabel(built.isoScale)}`);
  });

  it("hatches the section and defines the three patterns", () => {
    for (const id of ["hatch-carcass", "hatch-doubler", "hatch-cladding"])
      expect(built.svg).toContain(`id="${id}"`);
    expect(built.svg).toContain("url(#hatch-doubler)");
  });

  it("puts the cutting-plane symbol on the plan, not the front elevation", () => {
    const plan = built.svg.slice(built.svg.indexOf('data-view="plan"'));
    expect(built.svg).toContain(`stroke-dasharray="12 2 2 2"`);
    // The chain line sits at the plan's horizontal centre.
    const L = layout(sol.E);
    const x = L.cells.plan.x + (sol.E.x / 2) * L.scale;
    expect(built.svg).toContain(`M${Math.round(x * 1000) / 1000} `);
    expect(plan.length).toBeGreaterThan(0);
  });

  it("dimensions the overall sizes solid and the internal ones bracketed", () => {
    expect(built.svg).toContain(">236<");
    expect(built.svg).toContain(">286<");
    expect(built.svg).toContain(">356<");
    expect(built.svg).toContain(">(200)<");     // internal width
    expect(built.svg).toContain(">(232)<");     // internal depth: 286 − 18 − 18 − 18 doubler
    expect(built.svg).toContain(">(320)<");     // internal height
  });

  it("writes a well-formed single-root SVG", () => {
    expect(built.svg.startsWith("<svg ")).toBe(true);
    expect(built.svg.endsWith("</svg>")).toBe(true);
    expect(built.svg.match(/<svg /g)).toHaveLength(1);
  });
});

describe("§6.4 edge note", () => {
  it("writes one note when every edge shares a treatment", () => {
    expect(edgeNote(uniformEdges("fillet", 12))).toBe("ALL EXTERNAL EDGES R12.");
    expect(edgeNote(uniformEdges("chamfer", 6))).toBe("ALL EXTERNAL EDGES CHAMFER 6.");
    expect(edgeNote(noEdges())).toBe("ALL EXTERNAL EDGES SQUARE.");
  });

  it("lists the distinct treatments otherwise", () => {
    const mixed = { ...uniformEdges("fillet", 12), "front|top": { type: "chamfer", radius: 6 } };
    expect(edgeNote(mixed)).toContain("R12");
    expect(edgeNote(mixed)).toContain("CHAMFER 6");
  });
});
