/**
 * §19 What the path tracer is asked to trace.
 *
 * Reported from a phone: Refine "only displays part of the screen and it
 * flashes on and off". Two things behind that, and this covers the second —
 * the first was the canvas being resized every frame (§19), which reset the
 * trace before it could accumulate anything.
 *
 * The second is size. A phone reports a pixel ratio of 3, so a full-screen
 * canvas asks for eleven megapixels of path tracing on a device that has no
 * business attempting it.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { traceSize, tilesFor, TRACE_PIXEL_CAP, SETTLED_SAMPLES } from "../src/render/pathtrace.js";
import { withColour } from "../src/ui/RenderView.jsx";

const pixels = ([w, h]) => w * h;

describe("§19 the traced size is bounded", () => {
  it("traces a phone's screen at something a phone can finish", () => {
    // 390 x 780 at a ratio of 3 is 2.7 megapixels asked for; the cap is real.
    const size = traceSize(390, 780, 3);
    expect(pixels(size)).toBeLessThanOrEqual(TRACE_PIXEL_CAP);
    expect(size[0] / size[1]).toBeCloseTo(390 / 780, 2);   // and the shape is kept
  });

  it("never goes above twice the CSS size, whatever the display claims", () => {
    for (const ratio of [1, 2, 3, 4]) {
      const [w] = traceSize(500, 400, ratio);
      expect(w).toBeLessThanOrEqual(1000);
    }
  });

  it("leaves a small canvas exactly alone", () => {
    expect(traceSize(520, 420, 1)).toEqual([520, 420]);
    expect(traceSize(600, 400, 2)).toEqual([1200, 800]);
  });

  it("caps a large desktop canvas rather than refusing it", () => {
    const size = traceSize(1920, 1200, 2);
    expect(pixels(size)).toBeLessThanOrEqual(TRACE_PIXEL_CAP);
    expect(pixels(size)).toBeGreaterThan(TRACE_PIXEL_CAP * 0.9);   // and uses the budget
    expect(size[0] / size[1]).toBeCloseTo(1920 / 1200, 2);
  });

  it("never returns a size nothing can be drawn into", () => {
    for (const [w, h, r] of [[0, 0, 1], [1, 1, 3], [3, 2000, 3]]) {
      const [tw, th] = traceSize(w, h, r);
      expect(tw).toBeGreaterThanOrEqual(1);
      expect(th).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("§19 a frame is split only when it is worth splitting", () => {
  it("draws a small frame in one go, so no part-drawn frame is ever shown", () => {
    expect(tilesFor([520, 420])).toBe(1);
  });

  it("splits a big one, so the tab stays answerable while it traces", () => {
    expect(tilesFor([1752, 1256])).toBeGreaterThan(1);
  });

  it("settles at a number of samples worth waiting for", () => {
    expect(SETTLED_SAMPLES).toBeGreaterThan(50);
  });
});

/**
 * §19 The path tracer merges the whole scene into one geometry, and an
 * attribute that some parts carry and others do not comes out of that merge as
 * nonsense — bands of environment through the floor, coloured streaks over the
 * backdrop, light from nowhere. It took a screenshot to see and one line to
 * fix, which is the sort of bug worth a test.
 */
describe("§19 every part of the scene carries the same attributes", () => {
  const plain = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    return g;
  };

  it("gives a geometry a colour at every vertex when it has none", () => {
    const g = withColour(plain());
    const colour = g.getAttribute("color");
    expect(colour.count).toBe(g.getAttribute("position").count);
    expect(colour.itemSize).toBe(3);
    expect([...colour.array]).toEqual(new Array(9).fill(1));
  });

  it("makes it white, so the material's own colour is what shows", () => {
    for (const v of withColour(plain()).getAttribute("color").array) expect(v).toBe(1);
  });

  it("leaves a geometry that already has one alone", () => {
    const g = plain();
    const own = new Float32Array([0.5, 0.5, 0.5, 0.25, 0.25, 0.25, 1, 1, 1]);
    g.setAttribute("color", new THREE.BufferAttribute(own, 3));
    expect(withColour(g).getAttribute("color").array).toBe(own);
  });

  it("takes a shade, for anything that wants to be darker than white", () => {
    // Float32, so 0.4 comes back as the nearest float to 0.4.
    for (const v of withColour(plain(), 0.4).getAttribute("color").array) expect(v).toBeCloseTo(0.4, 6);
  });
});
