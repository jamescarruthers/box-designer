/** §9.6 Render and look — the parseable half, run on every commit.
 *  Parsing the sheet as XML catches the class of bug that broke the prototype:
 *  an unescaped character, a stray tag, a malformed path. */
import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { uniformEdges, noEdges } from "../src/model/bevel.js";
import { buildSheet } from "../src/drawing/sheet.js";
import { PROMINENCE_PRESETS, FACES } from "../src/model/constants.js";
import { explodeSink, explodeShift } from "../src/model/explode.js";

const CASES = [
  { name: "plain carcass", input: { envelope: { x: 236, y: 286, z: 356 }, thickness: 18 }, edges: noEdges() },
  { name: "filleted, clad and doubled", edges: uniformEdges("fillet", 12),
    input: { envelope: { x: 236, y: 286, z: 356 }, thickness: 18, cladding: { front: 6 }, doubler: { back: 12 } } },
  { name: "chamfered on every edge", edges: uniformEdges("chamfer", 8),
    input: { envelope: { x: 900, y: 400, z: 500 }, thickness: 22 } },
  { name: "small box, coarse scale", edges: noEdges(),
    input: { envelope: { x: 90, y: 110, z: 140 }, thickness: 9 } },
];

describe("the drawing renders as valid SVG", () => {
  for (const preset of PROMINENCE_PRESETS) {
    for (const c of CASES) {
      it(`${c.name}, ${preset.name}`, () => {
        const sol = solve({ ...c.input, order: preset.order });
        const { svg } = buildSheet(sol, c.edges, { title: "SHEET BOX — A&B <test>" });
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.documentElement.tagName).toBe("svg");

        // Nothing may carry a NaN coordinate.
        expect(svg).not.toMatch(/NaN|Infinity|undefined|null/);

        // Every path command must be complete.
        for (const el of doc.querySelectorAll("path"))
          expect(el.getAttribute("d")).toMatch(/^M-?[\d.]+ -?[\d.]+[AL]/);

        // Everything must land inside the sheet.
        for (const el of doc.querySelectorAll("rect, circle, text")) {
          for (const a of ["x", "y", "cx", "cy"]) {
            const v = el.getAttribute(a);
            if (v === null) continue;
            expect(Number(v)).toBeGreaterThan(-40);
            expect(Number(v)).toBeLessThan(a === "x" || a === "cx" ? 460 : 330);
          }
        }
      });
    }
  }

  it("keeps the en dash and the ampersand intact through escaping", () => {
    const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order: FACES });
    const { svg } = buildSheet(sol, noEdges(), { title: "A & B" });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const texts = [...doc.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts).toContain("SECTION A–A");
    expect(texts).toContain("A & B");
  });
});

/**
 * §54 The exploded box stands on the floor.
 *
 * §19 puts the box on a sweep so it is a photograph rather than a diagram, and
 * §51 let it come apart. Nobody put those two together: the bottom panels
 * explode *downwards* along their own normals and the floor does not go with
 * them, so an exploded box was half sunk into the studio.
 */
describe("§54 what stands on the floor", () => {
  const box = () => solve({
    envelope: { x: 236, y: 286, z: 356 }, thickness: 18, cladding: 6, doubler: 12, lagging: 8,
    order: PROMINENCE_PRESETS[0].order,
  });

  /** Where the lowest piece sits once the assembly has been stood up. */
  const lowest = (sol, explode) => {
    const stand = -explodeSink(sol.panels, explode);
    return Math.min(...sol.panels.map((p) => p.box.z[0] + explodeShift(p, explode).z + stand));
  };

  it("is nothing at all until the box comes apart", () => {
    expect(explodeSink(box().panels, 0)).toBe(0);
  });

  it("is the bottom cladding, which moves furthest and downwards", () => {
    // 1.5× the amount asked for: §38's scale for the outermost layer.
    expect(explodeSink(box().panels, 40)).toBeCloseTo(-60, 9);
    expect(explodeSink(box().panels, 120)).toBeCloseTo(-180, 9);
  });

  it("puts the lowest piece on the floor and nothing below it", () => {
    const sol = box();
    for (const explode of [0, 5, 20, 60, 120]) {
      expect(lowest(sol, explode)).toBeCloseTo(0, 9);
    }
  });

  it("holds for a bare carcass, where the bottom panel is the outermost thing", () => {
    const bare = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
      order: PROMINENCE_PRESETS[0].order });
    expect(explodeSink(bare.panels, 40)).toBeCloseTo(-40, 9);   // shell, scale 1
    expect(lowest(bare, 40)).toBeCloseTo(0, 9);
  });

  it("never lowers a box that was already on the floor", () => {
    // Sink is zero or negative and never positive: standing the box *up* on
    // nothing would lift it off the floor it is meant to be resting on.
    for (const explode of [0, 1, 40, 400]) {
      expect(explodeSink(box().panels, explode)).toBeLessThanOrEqual(0);
    }
  });
});
