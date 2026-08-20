/**
 * §13 The design, kept between visits.
 *
 * The interesting half is reading it back. A design saved last week was written
 * by last week's app; this week's has fields it never heard of, and undefined
 * reads as false, zero, or a crash.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";
import { mergeDesign, loadDesign, saveDesign, forgetDesign, STORAGE_KEY } from "../src/ui/storage.js";

/** A localStorage that can be made to misbehave, because the real one does. */
const makeStore = () => {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};

let store;
beforeEach(() => { store = makeStore(); });

describe("§13 a design survives the round trip", () => {
  it("comes back as it went in", () => {
    const design = { ...DEFAULT_DESIGN, title: "SUBWOOFER", thickness: 21, kerf: 4.2 };
    saveDesign(design, store);
    expect(loadDesign(store)).toEqual(design);
  });

  it("still solves after the round trip, which is the only thing that matters", () => {
    const design = {
      ...DEFAULT_DESIGN,
      cladding: { front: { material: "birch", thickness: 6 } },
      edge: { ...DEFAULT_DESIGN.edge, perEdge: true, by: { "front|left": { type: "mitre", radius: 12 } } },
      fittings: [{ id: "d1", type: "driver", face: "front", at: { a: 108, b: 163 },
        cutout: 116, pcd: 147, bolts: 5, boltHole: 5 }],
    };
    saveDesign(design, store);
    const back = loadDesign(store);
    expect(derive(back).sol.closureExact).toBe(true);
    expect(derive(back).rows.length).toBe(derive(design).rows.length);
  });

  it("opens the defaults when nothing was saved", () => {
    expect(loadDesign(store)).toEqual(DEFAULT_DESIGN);
  });
});

describe("§13 a design saved by an older app still opens", () => {
  it("fills in a field that did not exist when it was saved", () => {
    // No `fittings`, no `sectionAt`, no per-face thickness: an early save.
    const old = { title: "OLD", start: DEFAULT_DESIGN.start, thickness: 18, material: "birch" };
    const back = mergeDesign(DEFAULT_DESIGN, old);
    expect(back.title).toBe("OLD");
    expect(back.fittings).toEqual([]);
    expect(back.edge).toEqual(DEFAULT_DESIGN.edge);
    expect(() => derive(back)).not.toThrow();
  });

  it("fills in a field added inside an object, rather than leaving it undefined", () => {
    // A port saved before the tube flag existed: `tube` must come back true,
    // not undefined, or the tube quietly disappears.
    const saved = { ...DEFAULT_DESIGN, start: { ...DEFAULT_DESIGN.start, mode: "size" } };
    delete saved.start.basis;
    const back = mergeDesign(DEFAULT_DESIGN, saved);
    expect(back.start.basis).toBe(DEFAULT_DESIGN.start.basis);
    expect(back.start.mode).toBe("size");
  });

  it("drops a field the app has since retired", () => {
    const back = mergeDesign(DEFAULT_DESIGN, { ...DEFAULT_DESIGN, chamferEverything: true });
    expect("chamferEverything" in back).toBe(false);
  });

  it("keeps the open records, whose keys are faces and edges rather than a fixed set", () => {
    const back = mergeDesign(DEFAULT_DESIGN, {
      ...DEFAULT_DESIGN,
      cladding: { front: { material: "mdf", thickness: 9 }, back: { material: "birch", thickness: 6 } },
      edge: { ...DEFAULT_DESIGN.edge, by: { "front|top": { type: "fillet", radius: 8 } } },
    });
    expect(Object.keys(back.cladding).sort()).toEqual(["back", "front"]);
    expect(back.edge.by["front|top"]).toEqual({ type: "fillet", radius: 8 });
    expect(back.edge.radius).toBe(DEFAULT_DESIGN.edge.radius);   // the rest of `edge` survives
  });

  it("takes a list whole rather than merging it element by element", () => {
    const back = mergeDesign(DEFAULT_DESIGN, { ...DEFAULT_DESIGN, order: ["top", "bottom", "left", "right", "front", "back"] });
    expect(back.order).toEqual(["top", "bottom", "left", "right", "front", "back"]);
  });
});

describe("§13 storage that will not cooperate", () => {
  it("opens the defaults rather than failing on a corrupt save", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store.setItem(STORAGE_KEY, "{not json");
    expect(loadDesign(store)).toEqual(DEFAULT_DESIGN);
    warn.mockRestore();
  });

  it("does not throw when saving is refused, because the edit matters more", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} };
    expect(saveDesign(DEFAULT_DESIGN, full)).toBe(false);
    warn.mockRestore();
  });

  it("works with no storage at all", () => {
    expect(loadDesign(null)).toEqual(DEFAULT_DESIGN);
    expect(saveDesign(DEFAULT_DESIGN, null)).toBe(true);
    expect(() => forgetDesign(null)).not.toThrow();
  });

  it("forgets, so resetting is a way out rather than a new thing to save", () => {
    saveDesign({ ...DEFAULT_DESIGN, title: "GONE" }, store);
    forgetDesign(store);
    expect(store.getItem(STORAGE_KEY)).toBe(null);
    expect(loadDesign(store)).toEqual(DEFAULT_DESIGN);
  });
});
