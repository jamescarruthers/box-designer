/**
 * §17 The two numbers behind a clean line.
 *
 * Neither of them is about lines, quite: one is how wide to draw a quad that
 * stands in for one, and the other is where to put the depth planes so that two
 * surfaces a millimetre apart can be told apart at all. The second is the one
 * that actually made the picture look cheap, and it is invisible in any
 * screenshot of a single frame — it shows up as an edge that flickers along its
 * length as the box turns.
 */
import { describe, it, expect } from "vitest";
import { LINE_WIDTH, lineWidthFor, nearFar, sceneRadius } from "../src/three/lines.js";

describe("§17 line width survives the pixel ratio", () => {
  it("asks for the same width in CSS pixels whatever the display", () => {
    // The shader is given the drawing buffer, so its pixels are device pixels:
    // a 2× display drawing 1.4 of them draws half as thick as a 1× one.
    expect(lineWidthFor(1)).toBe(LINE_WIDTH);
    expect(lineWidthFor(2)).toBe(LINE_WIDTH * 2);
    expect(lineWidthFor(3)).toBe(LINE_WIDTH * 3);
  });

  it("never goes below one, whatever it is handed", () => {
    expect(lineWidthFor(0)).toBe(LINE_WIDTH);
    expect(lineWidthFor(undefined)).toBe(LINE_WIDTH);
  });

  it("is wider than a hairline, because a screen is not paper", () => {
    expect(LINE_WIDTH).toBeGreaterThan(1);
    expect(LINE_WIDTH).toBeLessThan(2.5);      // and not a marker pen
  });
});

describe("§17 the depth planes follow the camera", () => {
  const box = { x: 218, y: 263, z: 327 };

  it("spends the depth buffer on what is in front of it", () => {
    // 1 to 100000, which is what this was, leaves so little precision at the
    // far end that a panel and the edge lying on it land on the same value.
    const { near, far } = nearFar(900, sceneRadius(box));
    expect(far / near).toBeLessThan(10);
    expect(1 / near).toBeLessThan(1 / 100);
  });

  it("keeps the whole box between them, at any distance", () => {
    const r = sceneRadius(box);
    for (const dist of [80, 200, 900, 4000, 20000]) {
      const { near, far } = nearFar(dist, r);
      expect(near).toBeLessThan(Math.max(near, dist - r) + 1e-9);
      expect(far).toBeGreaterThan(dist + r);
      expect(near).toBeGreaterThan(0);
      expect(near).toBeLessThan(far);
    }
  });

  it("does not put the near plane behind the camera when it is inside the box", () => {
    const { near, far } = nearFar(10, sceneRadius(box));
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
  });

  it("counts an exploded box as bigger, because it is", () => {
    expect(sceneRadius(box, 60)).toBeGreaterThan(sceneRadius(box, 0));
    expect(sceneRadius(box, 0)).toBeCloseTo(Math.hypot(218, 263, 327) / 2, 9);
    // A negative slider value would shrink the far plane onto the box.
    expect(sceneRadius(box, -50)).toBe(sceneRadius(box, 0));
  });

  it("keeps an exploded panel inside the far plane", () => {
    const explode = 120;
    const { far } = nearFar(900, sceneRadius(box, explode));
    expect(far).toBeGreaterThan(900 + Math.hypot(218, 263, 327) / 2 + explode * 3);
  });
});
