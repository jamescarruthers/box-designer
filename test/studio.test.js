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
  equirectStudio, sampleStudio, directionAt, lampDirection, sweepShade,
  sweepProfile, framing, surfaceOf, RIG, SWEEP, SKY, GROUND, EXPOSURE,
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

  it("is the same all the way round, which is why it never has to be turned", () => {
    // The studio turns with the camera (§19). three r160 cannot rotate
    // `scene.environment`, so the environment has to be a thing that does not
    // need turning — no lamp painted into it, nothing to be caught facing the
    // wrong way. Every lamp is a real light in the rig instead.
    for (const elevation of [-0.6, 0, 0.4, 0.9]) {
      const round = [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * 2 * Math.PI;
        const c = Math.cos(elevation);
        return luminance(sampleStudio(env, [c * Math.sin(a), Math.sin(elevation), c * Math.cos(a)]));
      });
      for (const v of round) expect(v).toBeCloseTo(round[0], 6);
    }
  });

  it("stays a soft light rather than becoming a lamp", () => {
    // Nothing in it is brighter than white: the sky fills the shade and gets
    // reflected, and the modelling is the rig's job.
    for (const dir of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [0.4, 0.6, -0.7]]) {
      for (const channel of sampleStudio(env, dir)) expect(channel).toBeLessThan(1);
    }
  });
});

/**
 * The lamps are angles from where the camera stands, because the rig turns with
 * it. Azimuth 0 is a light beside the lens — the one place a light must not be.
 */
describe("§19 the rig", () => {
  it("is three lights, each doing one job", () => {
    expect(Object.keys(RIG)).toEqual(["key", "fill", "rim"]);
    expect(RIG.key.intensity).toBeGreaterThan(RIG.rim.intensity);
    expect(RIG.rim.intensity).toBeGreaterThan(RIG.fill.intensity);
  });

  it("keeps the key well off the camera's shoulder", () => {
    // A light next to the lens lights both visible faces the same, and a box
    // with two identical faces reads as a flat shape with a line down it.
    expect(Math.abs(RIG.key.azimuth)).toBeGreaterThan(0.8);
  });

  it("puts the fill opposite the key, low and weak", () => {
    expect(Math.sign(RIG.fill.azimuth)).toBe(-Math.sign(RIG.key.azimuth));
    expect(RIG.fill.elevation).toBeLessThan(RIG.key.elevation);
    // A fill that competes with the key is a second key, and two keys is no key.
    expect(RIG.fill.intensity).toBeLessThan(RIG.key.intensity / 3);
  });

  it("puts the rim behind the box, where the camera cannot see it directly", () => {
    expect(Math.abs(RIG.rim.azimuth)).toBeGreaterThan(Math.PI / 2);
    expect(RIG.rim.elevation).toBeGreaterThan(RIG.key.elevation);
  });

  it("lights everything from above the horizon, where a studio's lights are", () => {
    for (const lamp of Object.values(RIG)) {
      expect(lampDirection(lamp)[1]).toBeGreaterThan(0);
    }
  });

  it("draws one shadow, because three would overlap into mud", () => {
    expect(Object.values(RIG).filter((l) => l.casts)).toEqual([RIG.key]);
  });

  it("warms the key against a cool fill, the way a room does", () => {
    const warmth = (hex) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
    expect(warmth(RIG.key.colour)).toBeGreaterThan(0);
    expect(warmth(RIG.fill.colour)).toBeLessThan(0);
  });

  it("agrees with the direction the environment was written from", () => {
    expect(directionAt(0.5, 0)[1]).toBeCloseTo(1, 6);     // v = 0 is straight up
    expect(directionAt(0.5, 1)[1]).toBeCloseTo(-1, 6);    // v = 1 is straight down
    expect(directionAt(0.5, 0.5)[2]).toBeCloseTo(1, 6);   // and the middle faces +z
    // Azimuth 0 is the camera's own direction, which is +z before the stage is
    // turned — so a lamp at azimuth 0 would sit right beside the lens.
    expect(lampDirection({ azimuth: 0, elevation: 0 })).toEqual([0, 0, 1]);
  });
});

describe("§19 the sweep has no join in it", () => {
  const profile = sweepProfile(100, 300, 240, 0, 24);

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

  it("starts curving behind whatever is standing on it", () => {
    // Reported: "the box is slightly cut off by the curve on the floor". The
    // box is centred on the origin, so a curve that starts there rises through
    // its back half.
    const back = 400;
    const pushed = sweepProfile(100, 300, 240, back, 24);
    expect(pushed[1]).toEqual([-back, 0]);
    for (const [z, y] of pushed) {
      if (y > 0) expect(z).toBeLessThan(-back);
    }
    // Same curve, moved: still exactly on its radius, about its new centre.
    for (const [z, y] of pushed.slice(1, -1)) {
      expect(Math.hypot(z + back, y - 100)).toBeCloseTo(100, 6);
    }
  });
});

describe("§19 the sweep falls off around the box", () => {
  it("is at full brightness where the box stands", () => {
    expect(sweepShade(0)).toBe(1);
    expect(sweepShade(SWEEP.near)).toBe(1);
  });

  it("is down to the dark end by the time it leaves the frame", () => {
    expect(sweepShade(SWEEP.far)).toBeCloseTo(SWEEP.dark, 6);
    expect(sweepShade(50)).toBeCloseTo(SWEEP.dark, 6);
  });

  it("only ever darkens, and never steps", () => {
    let last = 1;
    for (let d = 0; d < 8; d += 0.05) {
      const here = sweepShade(d);
      expect(here).toBeLessThanOrEqual(last + 1e-9);
      expect(last - here).toBeLessThan(0.05);      // no line across the backdrop
      last = here;
    }
  });

  it("is measured in box diagonals, not in fractions of the sheet", () => {
    // The sheet is enormous so its edges are never in shot; a gradient spread
    // over the whole of it is a gradient nobody can see. Anchored to the box,
    // the pool of light is around the box whatever size the sheet is.
    expect(SWEEP.far).toBeLessThan(8);
    expect(framing({ x: 218, y: 263, z: 327 }).sweep.width / Math.hypot(218, 263, 327))
      .toBeGreaterThan(SWEEP.far * 2);
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

  it("looks down far enough to see the floor, now the wall is behind the box", () => {
    // With the sweep turned to sit behind the subject, a camera on the level
    // sees nothing but wall — and a box against a wall with no ground under it
    // floats. 1.1 radians of polar is about 27 degrees above the horizontal.
    expect(framing(E).polar).toBeLessThan(1.1);
  });

  it("keeps the curve far enough back to be a backdrop rather than a wall", () => {
    const { sweep, distance } = framing(E);
    // The curve has to start behind the box and finish behind that; a tight
    // radius just behind the subject puts the camera nose to nose with it.
    expect(sweep.radius).toBeGreaterThan(Math.hypot(E.x, E.y, E.z));
    expect(sweep.back + sweep.radius).toBeGreaterThan(distance);
  });

  it("makes the sweep big enough that its edges are out of shot", () => {
    const { sweep, distance } = framing(E);
    expect(sweep.width).toBeGreaterThan(distance * 2);
    expect(sweep.wallRise).toBeGreaterThan(E.z * 2);
    expect(sweep.floorRun).toBeGreaterThan(distance);
  });

  it("keeps the floor flat under the whole box, at any angle", () => {
    const { sweep } = framing(E);
    // The furthest the box reaches from the origin along the floor, which is
    // half its plan diagonal — the view can be turned to put that corner
    // anywhere, so the flat has to clear it whichever way round it is.
    expect(sweep.back).toBeGreaterThan(Math.hypot(E.x, E.y) / 2);
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
