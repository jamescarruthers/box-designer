/**
 * §19 The studio, checked without a GPU.
 *
 * A rendered view fails in ways that all look the same on screen: "it looks
 * flat", "it looks wrong". The lighting is arithmetic, though, and arithmetic
 * can be asked direct questions — is the sky above the box, is the key light
 * where it was put, does the sweep meet the floor without a step in it.
 */
import { describe, it, expect } from "vitest";
import {
  equirectStudio, sampleStudio, directionAt, lampDirection, lampFalloff,
  sweepProfile, framing, surfaceOf, KEY, FILL, SKY, GROUND, EXPOSURE,
} from "../src/three/studio.js";

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("§19 the environment is the right way up", () => {
  const env = equirectStudio(128, 64);

  it("puts the sky above and the ground below", () => {
    // The fault this is here for: written upside down, the box lights from
    // underneath and its top face goes dark, and nothing about the picture says
    // "your environment map is inverted".
    expect(luminance(sampleStudio(env, [0, 1, 0]))).toBeGreaterThan(luminance(sampleStudio(env, [0, -1, 0])));
    expect(sampleStudio(env, [0, 1, 0])[2]).toBeCloseTo(SKY[2], 2);
    expect(sampleStudio(env, [0, -1, 0])[2]).toBeCloseTo(GROUND[2], 2);
  });

  it("keeps the horizon between the two, rather than at either end", () => {
    const horizon = luminance(sampleStudio(env, [0, 0, 1]));
    expect(horizon).toBeLessThan(luminance(sampleStudio(env, [0, 1, 0])));
    expect(horizon).toBeGreaterThan(luminance(sampleStudio(env, [0, -1, 0])));
  });

  it("puts each lamp where it was asked for, and brighter than white", () => {
    for (const lamp of [KEY, FILL]) {
      const there = luminance(sampleStudio(env, lampDirection(lamp)));
      expect(there).toBeGreaterThan(luminance(sampleStudio(env, [0, 1, 0])));
    }
    // The key is a light; the fill is a lift. The difference between them is
    // what gives a box a lit side and a shaded one.
    expect(luminance(sampleStudio(env, lampDirection(KEY))))
      .toBeGreaterThan(3 * luminance(sampleStudio(env, lampDirection(FILL))));
    expect(luminance(sampleStudio(env, lampDirection(KEY)))).toBeGreaterThan(1);
  });

  it("lights from above the horizon, where a studio's lights are", () => {
    for (const lamp of [KEY, FILL]) expect(lampDirection(lamp)[1]).toBeGreaterThan(0);
  });

  it("keeps the key off the camera's shoulder", () => {
    // Framed at -0.68; a light within about half a radian of that lights both
    // visible faces the same and the box reads as a flat shape.
    expect(Math.abs(KEY.azimuth - framing({ x: 1, y: 1, z: 1 }).azimuth)).toBeGreaterThan(0.6);
  });
});

describe("§19 a lamp has a soft edge", () => {
  it("is full on axis and nothing outside its radius", () => {
    expect(lampFalloff(lampDirection(KEY), KEY)).toBeCloseTo(1, 6);
    // Moved in elevation, where the angle moved is the angle between the two
    // directions. The same step in azimuth is a smaller angle the higher the
    // lamp sits, which is a fine way to write a test that proves nothing.
    const away = lampDirection({ azimuth: KEY.azimuth, elevation: KEY.elevation - KEY.radius * 2 });
    expect(lampFalloff(away, KEY)).toBe(0);
  });

  it("falls off smoothly rather than stepping", () => {
    const at = (t) => lampFalloff(lampDirection({
      azimuth: KEY.azimuth, elevation: KEY.elevation - KEY.radius * t }), KEY);
    const steps = [0, 0.25, 0.5, 0.75, 1].map(at);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]);
    expect(steps.at(-1)).toBe(0);
    // Smoothstep: the middle is not the straight-line middle.
    expect(at(0.5)).toBeLessThan(0.6);
  });

  it("agrees with the direction the image was written from", () => {
    expect(directionAt(0.5, 0)[1]).toBeCloseTo(1, 6);     // v = 0 is straight up
    expect(directionAt(0.5, 1)[1]).toBeCloseTo(-1, 6);    // v = 1 is straight down
    expect(directionAt(0.5, 0.5)[2]).toBeCloseTo(1, 6);   // and the middle faces +z
  });
});

describe("§19 the sweep has no join in it", () => {
  const profile = sweepProfile(100, 300, 240, 24);

  it("starts along the floor and ends up the wall", () => {
    expect(profile[0]).toEqual([300, 0]);
    expect(profile.at(-1)).toEqual([-100, 240]);
  });

  it("leaves the floor horizontally and meets the wall vertically", () => {
    const [a, b] = [profile[0], profile[1]];
    expect(b[1] - a[1]).toBe(0);                          // still flat as it turns in
    const [c, d] = [profile.at(-2), profile.at(-1)];
    expect(d[0] - c[0]).toBeCloseTo(0, 6);                // and vertical as it leaves
  });

  it("never doubles back, so the surface cannot fold over itself", () => {
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i][0]).toBeLessThanOrEqual(profile[i - 1][0] + 1e-9);
      expect(profile[i][1]).toBeGreaterThanOrEqual(profile[i - 1][1] - 1e-9);
    }
  });

  it("puts the curve where the radius says, not somewhere near it", () => {
    // Every point of the arc is exactly `radius` from its centre, or the join
    // shows up as a crease in the one surface that must not have one.
    for (const [z, y] of profile.slice(1, -1)) {
      expect(Math.hypot(z - 0, y - 100)).toBeCloseTo(100, 6);
    }
  });
});

describe("§19 framing and surfaces", () => {
  const E = { x: 218, y: 263, z: 327 };

  it("stands back far enough to see the whole box", () => {
    const view = framing(E);
    expect(view.distance).toBeGreaterThan(Math.hypot(E.x, E.y, E.z));
    // Looking slightly down at it, from the three-quarter view a product is
    // photographed in.
    expect(view.polar).toBeLessThan(Math.PI / 2);
    expect(view.target[1]).toBeGreaterThan(0);
  });

  it("makes the sweep big enough that its edges are out of shot", () => {
    const { sweep, distance } = framing(E);
    expect(sweep.width).toBeGreaterThan(distance * 2);
    expect(sweep.wallRise).toBeGreaterThan(E.z * 2);
    expect(sweep.floorRun).toBeGreaterThan(distance);
  });

  it("keeps every sheet matte, because none of them is a mirror", () => {
    for (const grained of [true, false]) {
      const surface = surfaceOf({ grained });
      expect(surface.roughness).toBeGreaterThan(0.5);
      expect(surface.metalness).toBe(0);
    }
    // A sanded ply face is a little tighter than dyed fibreboard.
    expect(surfaceOf({ grained: true }).roughness).toBeLessThan(surfaceOf({ grained: false }).roughness);
  });

  it("exposes for a light grey sweep rather than for white", () => {
    expect(EXPOSURE).toBeGreaterThan(0.5);
    expect(EXPOSURE).toBeLessThanOrEqual(1.5);
  });
});
