/** §9.6 Render and look — the parseable half, run on every commit.
 *  Parsing the sheet as XML catches the class of bug that broke the prototype:
 *  an unescaped character, a stray tag, a malformed path. */
import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { uniformEdges, noEdges } from "../src/model/bevel.js";
import { buildSheet } from "../src/drawing/sheet.js";
import { PROMINENCE_PRESETS, FACES } from "../src/model/constants.js";
import { explodeSink, explodeShift, explodedBounds, explodedCentre } from "../src/model/explode.js";

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

/**
 * §55 The camera looks at the middle of what is on the stand.
 *
 * §19 aimed a little below the middle of the *box*, which flatters a box and
 * says nothing about an assembly that has come apart. The pieces spread both
 * ways from where they were, and a box clad on one face spreads lopsidedly, so
 * the middle of the box is not the middle of the picture.
 */
describe("§55 what the camera is looking at", () => {
  const E = { x: 236, y: 286, z: 356 };
  const plain = () => solve({ envelope: E, thickness: 18, order: PROMINENCE_PRESETS[0].order });
  /** Clad on the front only: it comes apart lopsidedly, which is the point. */
  const lopsided = () => solve({ envelope: E, thickness: 18, cladding: { front: 6 },
    order: PROMINENCE_PRESETS[0].order });

  it("is the box itself while the box is together", () => {
    const b = explodedBounds(plain().panels, 0);
    expect(b.x).toEqual([0, E.x]);
    expect(b.y).toEqual([0, E.y]);
    expect(b.z).toEqual([0, E.z]);
    expect(explodedCentre(plain().panels, 0)).toEqual({ x: E.x / 2, y: E.y / 2, z: E.z / 2 });
  });

  it("grows both ways as the box comes apart, and the middle stays put", () => {
    const sol = plain();
    for (const explode of [10, 40, 120]) {
      const b = explodedBounds(sol.panels, explode);
      // A bare carcass moves by the amount asked for, §38's shell scale being 1.
      expect(b.z[0]).toBeCloseTo(-explode, 9);
      expect(b.z[1]).toBeCloseTo(E.z + explode, 9);
      // Symmetric, so the middle has not moved.
      expect(explodedCentre(sol.panels, explode).z).toBeCloseTo(E.z / 2, 9);
    }
  });

  it("follows the middle when the box comes apart lopsidedly", () => {
    // Cladding on the front alone: the front leaves at 1.5x and there is
    // nothing on the back to balance it, so the middle moves forward.
    const sol = lopsided();
    const still = explodedCentre(sol.panels, 0);
    const apart = explodedCentre(sol.panels, 60);
    expect(apart.y).toBeLessThan(still.y);          // −y is the front
    expect(apart.x).toBeCloseTo(still.x, 9);        // and nothing else moved
    expect(apart.z).toBeCloseTo(still.z, 9);
  });

  it("is never the middle of the box once that stops being true", () => {
    // The claim the fix rests on: aiming at a fixed fraction of the envelope
    // is aiming somewhere other than at the thing on screen.
    const sol = lopsided();
    const apart = explodedCentre(sol.panels, 60);
    expect(Math.abs(apart.y - E.y / 2)).toBeGreaterThan(5);
  });

  it("agrees with §54 about how far the lowest piece has dropped", () => {
    // One traversal, one truth: the sink is the bottom of these bounds, and a
    // second opinion about it is how the floor and the camera drift apart.
    for (const sol of [plain(), lopsided()]) {
      for (const explode of [0, 30, 90]) {
        expect(explodeSink(sol.panels, explode))
          .toBeCloseTo(Math.min(0, explodedBounds(sol.panels, explode).z[0]), 9);
      }
    }
  });
});
