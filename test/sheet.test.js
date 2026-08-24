import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";
import { noEdges, uniformEdges } from "../src/model/bevel.js";
import { applyMitres } from "../src/model/mitre.js";
import { fittingDimensions, DIM_ANGLE } from "../src/drawing/fittings.js";
import { newFitting } from "../src/model/fittings.js";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";
import { buildSheet, layout, planDimensions, pickScale, scaleLabel, edgeNote, mitreDrawingNote, noteText, isoFit, withoutLagging, SHEET, TITLE_BLOCK, LW, TS, PREFERRED_SCALES, GAP_H, GAP_V, frameRect } from "../src/drawing/sheet.js";
import { HATCH } from "../src/drawing/section.js";
import { buildIsometric } from "../src/drawing/iso.js";
import { addPanel, editPanel } from "../src/ui/design.js";
import { FACES } from "../src/model/constants.js";

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

describe("§6.7 dimensions measure what they say", () => {
  const cases = [
    ["plain carcass", { envelope: { x: 236, y: 286, z: 356 }, thickness: 18 }],
    ["front doubler", { envelope: { x: 236, y: 286, z: 356 }, thickness: 18, doubler: { front: 18 } }],
    ["clad and doubled", { envelope: { x: 400, y: 300, z: 500 }, thickness: 22, cladding: { front: 6, top: 6 }, doubler: { back: 12, left: 9 } }],
    ["thin walls", { envelope: { x: 180, y: 220, z: 260 }, thickness: 6 }],
  ];

  it.each(cases)("%s: every dimension spans the length it prints", (_name, input) => {
    const s = solve({ ...input, order: ["front", "back", "left", "right", "top", "bottom"] });
    const plan = planDimensions(s, layout(s.E));
    expect(plan.length).toBe(7);
    for (const d of plan) {
      // This is the bug the drawing had: an internal dimension anchored to the
      // envelope drew the overall width and printed the internal number on it.
      expect(d.span[1] - d.span[0]).toBeCloseTo(Number(d.text), 6);
    }
  });

  it.each(cases)("%s: internal dimensions are bracketed and sit inside the overall ones", (_name, input) => {
    const s = solve({ ...input, order: ["front", "back", "left", "right", "top", "bottom"] });
    const plan = planDimensions(s, layout(s.E));
    const internal = plan.filter((d) => d.reference);
    const overall = plan.filter((d) => !d.reference);
    expect(internal).toHaveLength(4);
    expect(overall).toHaveLength(3);
    for (const d of internal) expect(Math.abs(d.off)).toBeLessThan(Math.abs(overall[0].off));
    // Every internal span is strictly inside the envelope it is drawn against.
    for (const d of internal) expect(d.span[0]).toBeGreaterThan(0);
  });

  it("prints the internal sizes the solver reports, not the envelope", () => {
    const s = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, doubler: { front: 18 },
      order: ["front", "back", "left", "right", "top", "bottom"] });
    const texts = planDimensions(s, layout(s.E)).filter((d) => d.reference).map((d) => Number(d.text));
    expect(texts).toContain(s.internal.x);
    expect(texts).toContain(s.internal.y);
    expect(texts).toContain(s.internal.z);
    expect(texts).not.toContain(s.E.x);
    expect(texts).not.toContain(s.E.y);
  });

  it("drops a dimension the box has no room for", () => {
    const flat = solve({ envelope: { x: 36, y: 200, z: 200 }, thickness: 18,
      order: ["front", "back", "left", "right", "top", "bottom"] });
    expect(flat.internal.x).toBe(0);
    const plan = planDimensions(flat, layout(flat.E));
    expect(plan.every((d) => d.span[1] - d.span[0] > 0)).toBe(true);
    expect(plan.length).toBeLessThan(7);
  });
});

describe("§6.4 edge note", () => {
  it("writes one note when every edge shares a treatment", () => {
    expect(edgeNote(uniformEdges("fillet", 12))).toBe("ALL EXTERNAL EDGES R12.");
    expect(edgeNote(uniformEdges("chamfer", 6))).toBe("ALL EXTERNAL EDGES CHAMFER 6.");
    expect(edgeNote(noEdges())).toBe("ALL EXTERNAL EDGES SQUARE.");
  });

  it("§12 notes the mitred joints on their own line", () => {
    const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order: PROMINENCE_PRESETS[0].order });
    const four = ["front|left", "back|left", "front|right", "back|right"];
    const of = (keys) => mitreDrawingNote(
      applyMitres(sol.panels, sol.env, Object.fromEntries(keys.map((k) => [k, true]))).panels);
    expect(of(four)).toBe("ALL VERTICAL CORNERS MITRED 45°.");
    expect(of(["front|left"])).toBe("MITRED 45°: FRONT/LEFT.");
    expect(mitreDrawingNote(sol.panels)).toBe(null);
  });

  it("lists the distinct treatments otherwise", () => {
    const mixed = { ...uniformEdges("fillet", 12), "front|top": { type: "chamfer", radius: 6 } };
    expect(edgeNote(mixed)).toContain("R12");
    expect(edgeNote(mixed)).toContain("CHAMFER 6");
  });
});


/**
 * §6.7 Fitting dimensions.
 *
 * A hole is dimensioned by diameter, never by radius, and repeated holes are
 * dimensioned once and counted. The drawing had the circles but no numbers,
 * which makes it a picture of a driver rather than instructions for cutting one.
 */
describe("§6.7 the fittings are dimensioned", () => {
  const E = { x: 236, y: 286, z: 356 };
  const driver = newFitting("driver", "front", { a: 118, b: 240 });
  const port = newFitting("port", "back", { a: 118, b: 90 });
  const dims = (view, fs) => fittingDimensions(view, fs, E);

  it("gives a driver its bore, its PCD and its bolt holes", () => {
    const d = dims("front", [driver]);
    expect(d.map((x) => x.text)).toEqual(["⌀116", "⌀147 PCD", "5×⌀5"]);
  });

  it("counts the bolt holes rather than dimensioning each one", () => {
    expect(dims("front", [driver]).filter((x) => x.kind === "leader")).toHaveLength(1);
    expect(dims("front", [driver]).find((x) => x.kind === "leader").text).toBe("5×⌀5");
  });

  it("dimensions by diameter, at the diameter and not the radius", () => {
    const bore = dims("front", [driver])[0];
    expect(bore.kind).toBe("diameter");
    expect(bore.r).toBe(driver.cutout / 2);      // the renderer draws 2r across
  });

  it("gives a port its bore, and its tube length only when it has a tube", () => {
    expect(dims("front", [port]).map((x) => x.text)).toEqual(["⌀68 × 150"]);
    expect(dims("front", [{ ...port, tube: false }]).map((x) => x.text)).toEqual(["⌀68"]);
  });

  it("only dimensions in the view that looks at the face square-on", () => {
    expect(dims("plan", [driver])).toEqual([]);
    expect(dims("end", [driver])).toEqual([]);
  });

  it("turns a far-face fitting's leaders the other way, so two sets do not stack", () => {
    // front and back share the front elevation, and at 1:5 two sets of leaders
    // in the same quadrant are unreadable.
    const near = dims("front", [driver])[0].angle;
    const far = dims("front", [port])[0].angle;
    expect(far - near).toBe(180);
  });

  it("skips the bolt dimensions on a driver with no bolts", () => {
    expect(dims("front", [{ ...driver, bolts: 0 }]).map((x) => x.text)).toEqual(["⌀116"]);
  });

  it("draws them onto the sheet, with the diameter sign and the count", () => {
    const svg = derive({ ...DEFAULT_DESIGN, fittings: [
      { ...driver, at: { a: 108.85, b: 163.35 } },
    ] }).sheet.svg;
    expect(svg).toContain("⌀116");
    expect(svg).toContain("⌀147 PCD");
    expect(svg).toContain("5×⌀5");
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});


/**
 * §32 What the sheet shows, and how a lining reads on it.
 *
 * Three things a reader of the drawing decides: whether the lining is drawn at
 * all, whether the section is, and — since the section's column is a third of
 * the sheet — what happens to the space when it goes.
 */
const lined = solve({ envelope: { x: 238, y: 283, z: 347 }, thickness: 18, lagging: 10,
  order: ["front", "back", "left", "right", "top", "bottom"] });

describe("§32 the lining in section", () => {
  it("is stippled rather than hatched, so it cannot read as another board", () => {
    // The old lining hatch was 45° lines like the boards either side of it,
    // which is a difference you measure rather than see.
    expect(HATCH.lagging.kind).toBe("dots");
    for (const key of ["shell", "doubler", "cladding"]) {
      expect(HATCH[key].kind).toBeUndefined();
      expect(HATCH[key].angle).toBeTypeOf("number");
    }
    const svg = buildSheet(lined, noEdges(), {}).svg;
    const pattern = /<pattern id="hatch-lagging"[^>]*>(.*?)<\/pattern>/s.exec(svg)[1];
    expect(pattern).toMatch(/<circle/);
    expect(pattern).not.toMatch(/<line/);
    // And the pattern is staggered, not a grid: two dots, off-diagonal.
    expect((pattern.match(/<circle/g) ?? [])).toHaveLength(2);
  });

  it("names the stipple in the note, and only where a lining is drawn", () => {
    expect(noteText({})).toMatch(/STIPPLE = LAGGING/);
    expect(noteText({ insulation: false })).not.toMatch(/LAGGING/);
    // With no section there is no hatching key to read at all.
    expect(noteText({ section: false })).not.toMatch(/HATCHING/);
    expect(noteText({ section: false })).toMatch(/HIDDEN DETAIL DASHED/);
  });
});

describe("§32 hiding the insulation", () => {
  it("draws the box without it rather than drawing it and covering it", () => {
    const on = buildSheet(lined, noEdges(), {});
    const off = buildSheet(lined, noEdges(), { insulation: false });
    expect(on.svg).toMatch(/url\(#hatch-lagging\)/);
    expect(off.svg).not.toMatch(/url\(#hatch-lagging\)/);
    expect(off.geometry.section.hatches.every((h) => h.panel.layer !== "lagging")).toBe(true);
    // Six panels fewer in every view, and the box the same size in all of them.
    expect(withoutLagging(lined).panels).toHaveLength(lined.panels.length - 6);
    expect(off.scale).toBe(on.scale);
    expect(off.layout.cells).toEqual(on.layout.cells);
  });

  it("leaves a box with no lining exactly as it was", () => {
    // Same object back, so nothing downstream re-renders for a filter that
    // filtered nothing.
    expect(withoutLagging(sol)).toBe(sol);
    expect(buildSheet(sol, noEdges(), { insulation: false }).svg)
      .toBe(buildSheet(sol, noEdges(), {}).svg);
  });

  it("keeps every other panel at the index the bevels were resolved against", () => {
    // The kernel path sends per-panel bevels and fittings by index, so this is
    // load-bearing: the lining has to be the *last* group of panels.
    const kept = withoutLagging(lined).panels;
    expect(lined.panels.slice(0, kept.length)).toEqual(kept);
    expect(lined.panels.slice(kept.length).every((p) => p.layer === "lagging")).toBe(true);
  });
});

describe("§32 hiding the section", () => {
  it("takes the view, its cutting plane and its dimension off the sheet", () => {
    const off = buildSheet(lined, noEdges(), { section: false });
    expect(off.svg).not.toMatch(/data-view="section"/);
    expect(off.svg).not.toMatch(/SECTION A–A/);
    // The plane marker on the plan points at a view that would not be there.
    expect(buildSheet(lined, noEdges(), {}).svg).toMatch(/SECTION A–A/);
    // The internal height is still dimensioned — on the front elevation, where
    // it always was; only the section's repeat of it goes.
    const dims = planDimensions(lined, layout(lined.E, { section: false }));
    expect(dims.some((d) => d.kind === "v" && d.text === String(Math.round(lined.internal.z)))).toBe(true);
  });

  it("gives the isometric the right of the sheet, and more of it", () => {
    const ext = buildIsometric(lined).ext;
    const withIt = layout(lined.E).cells.iso;
    const without = layout(lined.E, { section: false, isoExt: ext }).cells.iso;
    // Further right, taller, and drawn at a larger scale for it.
    expect(without.x).toBeGreaterThan(withIt.x);
    expect(without.h).toBeGreaterThan(withIt.h);
    expect(isoFit(without, ext)).toBeGreaterThan(isoFit(withIt, ext));
    expect(buildSheet(lined, noEdges(), { section: false }).isoScale)
      .toBeGreaterThan(buildSheet(lined, noEdges(), {}).isoScale);
    // Out to the frame rather than stopping at the column the section had.
    expect(without.x + without.w).toBeGreaterThan(withIt.x + layout(lined.E).cols[2]);
    expect(without.x + without.w).toBeLessThanOrEqual(frameRect().x + frameRect().w);
  });

  it("never draws the isometric smaller than it was", () => {
    // A long low box projects wide, and a tall narrow column suits it badly —
    // so the bottom strip out to the frame is offered as well, and whichever
    // draws it bigger is the one used.
    for (const E of [{ x: 900, y: 400, z: 500 }, { x: 200, y: 250, z: 900 },
      { x: 400, y: 400, z: 400 }, { x: 238, y: 283, z: 347 }]) {
      const box = solve({ envelope: E, thickness: 18 });
      const ext = buildIsometric(box).ext;
      const before = isoFit(layout(E).cells.iso, ext);
      const after = isoFit(layout(E, { section: false, isoExt: ext }).cells.iso, ext);
      expect(after, JSON.stringify(E)).toBeGreaterThanOrEqual(before);
    }
  });
});

describe("§32 the options in the design", () => {
  it("starts with both on and carries them into the sheet", () => {
    expect(DEFAULT_DESIGN.drawing).toEqual({ section: true, insulation: true });
    const d = derive(DEFAULT_DESIGN);
    expect(d.drawing).toEqual({ section: true, insulation: true });
    expect(d.sheet.section).toBe(true);
    expect(d.sheet.insulation).toBe(true);
  });

  it("fills in what an older saved design never had", () => {
    // A design saved before these existed has no `drawing` at all, and an
    // undefined flag must not read as "off".
    const old = { ...DEFAULT_DESIGN, drawing: undefined };
    expect(derive(old).drawing).toEqual({ section: true, insulation: true });
    expect(derive({ ...DEFAULT_DESIGN, drawing: { section: false } }).drawing)
      .toEqual({ section: false, insulation: true });
  });

  it("turns them off through the design", () => {
    const felt = FACES.reduce((x, f) => editPanel(addPanel(x, "lagging", f), "lagging", f, { thickness: 10 }), DEFAULT_DESIGN);
    const both = derive({ ...felt, drawing: { section: false, insulation: false } });
    expect(both.sheet.svg).not.toMatch(/SECTION A–A/);
    expect(both.sheet.svg).not.toMatch(/url\(#hatch-lagging\)/);
    expect(derive(felt).sheet.svg).toMatch(/url\(#hatch-lagging\)/);
  });
});
