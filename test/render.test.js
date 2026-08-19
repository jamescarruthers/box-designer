/** §9.6 Render and look — the parseable half, run on every commit.
 *  Parsing the sheet as XML catches the class of bug that broke the prototype:
 *  an unescaped character, a stray tag, a malformed path. */
import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { uniformEdges, noEdges } from "../src/model/bevel.js";
import { buildSheet } from "../src/drawing/sheet.js";
import { PROMINENCE_PRESETS, FACES } from "../src/model/constants.js";

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
