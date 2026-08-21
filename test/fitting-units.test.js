/**
 * §20 A fitting's position, in millimetres or as a proportion of its panel.
 *
 * A driver is usually centred, or a third of the way up — and that is a
 * proportion, not a measurement. Written as one it stays where it was put when
 * the box changes size; written in millimetres it does not.
 */
import { describe, it, expect } from "vitest";
import { resolveAt, convertAt, resolveFittings, faceAxes } from "../src/model/fittings.js";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";

const driver = (extra = {}) => ({
  id: "d1", type: "driver", face: "front", at: { a: 100, b: 120 },
  cutout: 116, pcd: 147, bolts: 5, boltHole: 5, ...extra,
});

const panelOf = (design = DEFAULT_DESIGN, face = "front") => {
  const d = derive({ ...design, fittings: [driver()] });
  return { panel: d.fittingPanels[face], derived: d };
};

describe("§20 a position given as a proportion", () => {
  it("is a percentage across the panel on each axis", () => {
    const { panel } = panelOf();
    const [p, q] = faceAxes("front");
    const at = resolveAt(driver({ units: "ratio", at: { a: 50, b: 25 } }), panel);
    const middle = (axis) => (panel.box[axis][0] + panel.box[axis][1]) / 2;
    expect(at.a).toBeCloseTo(middle(p), 6);
    expect(at.b).toBeCloseTo(panel.box[q][0] + (panel.box[q][1] - panel.box[q][0]) * 0.25, 6);
  });

  it("leaves a position in millimetres exactly as it was", () => {
    const { panel } = panelOf();
    const f = driver();
    expect(resolveAt(f, panel)).toBe(f.at);
    expect(resolveAt(driver({ units: "mm" }), panel)).toEqual({ a: 100, b: 120 });
  });

  it("stays put when the box changes size, which is the point of it", () => {
    const centred = driver({ units: "ratio", at: { a: 50, b: 50 } });
    const middleOf = (litres) => {
      const design = { ...DEFAULT_DESIGN, start: { ...DEFAULT_DESIGN.start, litres }, fittings: [centred] };
      const d = derive(design);
      const panel = d.fittingPanels.front;
      const [p] = faceAxes("front");
      return [d.fittings[0].at.a, (panel.box[p][0] + panel.box[p][1]) / 2];
    };
    for (const litres of [6, 12, 30]) {
      const [at, middle] = middleOf(litres);
      expect(at).toBeCloseTo(middle, 6);
    }
    // And the two boxes really are different sizes, or this proves nothing.
    expect(middleOf(6)[1]).not.toBeCloseTo(middleOf(30)[1], 1);
  });

  it("comes out of derive in millimetres, so nothing downstream has to know", () => {
    const d = derive({ ...DEFAULT_DESIGN, fittings: [driver({ units: "ratio", at: { a: 50, b: 50 } })] });
    expect(d.fittings[0].units).toBe("mm");
    for (const v of Object.values(d.fittings[0].at)) expect(Number.isFinite(v)).toBe(true);
    // The cut list carries the hole, wherever it was written down.
    expect(d.rows.some((r) => r.fittings.length)).toBe(true);
  });

  it("resolves a whole list against each fitting's own panel", () => {
    const { derived: d } = panelOf();
    const two = [driver({ units: "ratio", at: { a: 50, b: 50 } }),
      driver({ id: "d2", face: "left", units: "ratio", at: { a: 50, b: 50 } })];
    const out = resolveFittings(two, d.fittingPanels);
    expect(out).toHaveLength(2);
    for (const f of out) expect(f.units).toBe("mm");
  });
});

describe("§20 switching units moves the number, not the fitting", () => {
  it("gives the same place back, both ways round", () => {
    const { panel } = panelOf();
    const mm = driver();
    const asRatio = { ...mm, units: "ratio", at: convertAt(mm, panel, "ratio") };
    expect(resolveAt(asRatio, panel).a).toBeCloseTo(mm.at.a, 1);
    expect(resolveAt(asRatio, panel).b).toBeCloseTo(mm.at.b, 1);

    const back = { ...asRatio, units: "mm", at: convertAt(asRatio, panel, "mm") };
    expect(back.at.a).toBeCloseTo(mm.at.a, 1);
    expect(back.at.b).toBeCloseTo(mm.at.b, 1);
  });

  it("reads the middle of a panel as fifty per cent", () => {
    const { panel } = panelOf();
    const [p, q] = faceAxes("front");
    const middle = driver({ at: {
      a: (panel.box[p][0] + panel.box[p][1]) / 2,
      b: (panel.box[q][0] + panel.box[q][1]) / 2,
    } });
    expect(convertAt(middle, panel, "ratio")).toEqual({ a: 50, b: 50 });
  });

  it("does nothing when the units are already what was asked for", () => {
    const { panel } = panelOf();
    const f = driver();
    expect(convertAt({ ...f, units: "mm" }, panel, "mm")).toBe(f.at);
  });

  it("does nothing without a panel to measure against", () => {
    const f = driver();
    expect(convertAt(f, null, "ratio")).toBe(f.at);
  });
});
