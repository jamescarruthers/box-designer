/**
 * §22 The driver, as a shape.
 *
 * A box with a hundred-millimetre hole in it is a box with a hole in it. With
 * the frame diameter known there is enough to draw the driver that goes in it —
 * and a driver drawn wrong is drawn pointing into the cavity, or sunk through
 * the baffle, or flickering against the panel it is bolted to. All of those are
 * arithmetic, so all of them can be asked directly.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  DEFAULT_DRIVER, DRIVER_SHAPE, driverOuter, driverProfile, driverConeFrom,
  driverStandoff, fittingOrigin, fittingIssues, driverCone,
  driverDisplacement, portDisplacement, revolvedVolume, clipBelow, hasVd,
} from "../src/model/fittings.js";
import { driverBody, aimAt, faceNormal, placeDriver, driversOn, SEAT } from "../src/three/driver.js";
import { toThree } from "../src/three/panelGeometry.js";
import { AXIS, FACES } from "../src/model/constants.js";

// The driver the shape was set against: Markaudio Pluvia 7P, whose datasheet
// gives ⌀122.3 frame, ⌀100 cutout, 112 PCD, 5 × ⌀3.1.
const PLUVIA = { ...DEFAULT_DRIVER, cutout: 100, outer: 122.3, pcd: 112, bolts: 5, boltHole: 3.1 };

describe("§22 the profile that gets revolved", () => {
  const profile = driverProfile(PLUVIA);

  it("closes on the axis at both ends, so the body is a solid", () => {
    // An open lathe is a sheet of paper: it has no inside, and the path tracer
    // lights it as though it had none.
    expect(profile[0][0]).toBe(0);
    expect(profile.at(-1)[0]).toBeCloseTo(0, 9);
  });

  it("reaches exactly as wide as the frame, and no wider", () => {
    expect(Math.max(...profile.map(([r]) => r))).toBeCloseTo(driverOuter(PLUVIA) / 2, 9);
  });

  it("keeps the part that goes through the hole inside the hole", () => {
    // Every point below the panel face has to clear the cutout, or the driver
    // is modelled passing through solid material — and where the two surfaces
    // are exactly equal they flicker against each other instead.
    const Rc = PLUVIA.cutout / 2;
    for (const [r, h] of profile) {
      if (h < 0) expect(r).toBeLessThanOrEqual(Rc - DRIVER_SHAPE.slop + 1e-9);
    }
  });

  it("puts the flat back behind everything in front of it", () => {
    const back = Math.min(...profile.map(([, h]) => h));
    // The cone tip and the dust cap both have to be in front of the disc that
    // closes the body off, or it cuts through the thing it is closing.
    const cone = profile.slice(driverConeFrom());
    for (const [, h] of cone) expect(h).toBeGreaterThan(back);
  });

  it("stands proud of the panel by the frame and the surround", () => {
    const top = Math.max(...profile.map(([, h]) => h));
    expect(top).toBeCloseTo(driverStandoff(PLUVIA), 9);
    // 8.5 mm on a driver with a 4.5 mm frame: the surround rolls above it.
    expect(driverStandoff(PLUVIA)).toBeGreaterThan(driverOuter(PLUVIA) * DRIVER_SHAPE.flange);
  });

  it("gives the frame the thickness the datasheet gives it", () => {
    // The proportions are chosen against a real drawing rather than invented:
    // 122.3 × 0.037 is 4.53, and the Pluvia's frame is 4.5 ± 0.2.
    expect(driverOuter(PLUVIA) * DRIVER_SHAPE.flange).toBeCloseTo(4.5, 1);
  });

  it("recesses the cone below the frame, the way a cone sits", () => {
    const flange = driverOuter(PLUVIA) * DRIVER_SHAPE.flange;
    const cap = profile.at(-1)[1];
    expect(cap).toBeLessThan(flange);
  });

  it("splits frame from cone at a boundary counted in one place", () => {
    for (const steps of [4, 8, 16]) {
      const p = driverProfile(PLUVIA, steps);
      const from = driverConeFrom(steps);
      expect(from).toBeLessThan(p.length);
      // Everything from the boundary on runs inward and is the cone.
      expect(p[from][0]).toBeLessThan(p[from - 1][0]);
    }
  });
});

describe("§22 the body", () => {
  it("is a grid of one row per profile point", () => {
    const segments = 32;
    const body = driverBody(PLUVIA, segments);
    expect(body.getAttribute("position").count).toBe((segments + 1) * driverProfile(PLUVIA).length);
  });

  it("carries a colour at every vertex, in exactly two tones", () => {
    // §19 One attribute, everywhere: the path tracer merges the scene into one
    // geometry, and a colour some meshes have and others lack corrupts it.
    const colour = driverBody(PLUVIA).getAttribute("color");
    expect(colour.count).toBe(driverBody(PLUVIA).getAttribute("position").count);
    const tones = new Set();
    for (let i = 0; i < colour.count; i++) tones.add(`${colour.getX(i)}|${colour.getY(i)}|${colour.getZ(i)}`);
    expect(tones.size).toBe(2);
  });

  it("paints the cone lighter than the frame, because paper is not cast iron", () => {
    const body = driverBody(PLUVIA);
    const colour = body.getAttribute("color");
    const rows = driverProfile(PLUVIA).length;
    const lum = (i) => 0.2126 * colour.getX(i) + 0.7152 * colour.getY(i) + 0.0722 * colour.getZ(i);
    const frameVertex = [...Array(colour.count).keys()].find((i) => i % rows === 0);
    const coneVertex = [...Array(colour.count).keys()].find((i) => i % rows === rows - 1);
    expect(lum(coneVertex)).toBeGreaterThan(lum(frameVertex));
  });

  it("is no wider than the frame once it is round", () => {
    const body = driverBody(PLUVIA);
    body.computeBoundingBox();
    const R = driverOuter(PLUVIA) / 2;
    expect(body.boundingBox.max.x).toBeCloseTo(R, 3);
    expect(body.boundingBox.max.z).toBeCloseTo(R, 3);
  });
});

/**
 * §22 The scene is not in model coordinates, and the difference is not an axis
 * swap. `toThree` is a rotation — the model's z becomes the scene's height and
 * the model's y its −z — and it re-centres the box on the origin as it goes
 * (§4.3). A driver aimed and placed in the model's own coordinates came out
 * lying on its side, half a box away from the panel it was bolted to. That is
 * what these are here to catch.
 */
describe("§22 which way a driver faces", () => {
  const E = { x: 300, y: 300, z: 400 };

  it("points along the same direction the panels were rotated into", () => {
    // Derived from `toThree` rather than written out six times, so the two
    // cannot drift: the box is drawn through that transform and the driver has
    // to agree with it.
    for (const face of FACES) {
      const [axis, sign] = AXIS[face];
      const step = { x: 0, y: 0, z: 0 };
      step[axis] = sign;
      const want = toThree([step.x, step.y, step.z], { x: 0, y: 0, z: 0 });
      const got = faceNormal(face);
      expect([got.x, got.y, got.z].map(Math.round)).toEqual(want.map(Math.round));
    }
  });

  it("turns the body to face that way, on all six", () => {
    for (const face of FACES) {
      const o = aimAt(new THREE.Object3D(), face);
      const out = new THREE.Vector3(0, 1, 0).applyQuaternion(o.quaternion);
      expect(out.distanceTo(faceNormal(face))).toBeCloseTo(0, 6);
    }
  });

  it("stands the front driver up toward the viewer, not on its side", () => {
    // The front of the box faces the camera in the default view, so its driver
    // points along +z and its axis is horizontal. Edge-on was the symptom.
    const out = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(aimAt(new THREE.Object3D(), "front").quaternion);
    expect(out.z).toBeCloseTo(1, 6);
    expect(out.y).toBeCloseTo(0, 6);
    // And the top of the box keeps its driver pointing at the sky.
    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(aimAt(new THREE.Object3D(), "top").quaternion);
    expect(up.y).toBeCloseTo(1, 6);
  });

  it("sits on the outer surface of the panel it is bolted to", () => {
    const panel = { face: "front", layer: "shell", box: { x: [0, 300], y: [0, 18], z: [0, 400] } };
    const f = { ...PLUVIA, face: "front", at: { a: 150, b: 200 } };
    const mesh = placeDriver(new THREE.Mesh(), f, panel, E);
    const o = fittingOrigin(f, panel);
    // A hair proud along the face's own axis, before the transform: the
    // underside of the frame and the face of the panel are the same plane, and
    // two surfaces in one plane flicker against each other where both are drawn.
    const want = toThree([o.x, o.y - SEAT, o.z], E);
    expect([mesh.position.x, mesh.position.y, mesh.position.z])
      .toEqual(want.map((v) => expect.closeTo(v, 9)));
    expect(SEAT).toBeLessThan(0.1);
  });

  it("lands where the panel is, not a box-width from it", () => {
    // Centred on a 300 x 400 front panel, the driver belongs on the middle of
    // that face — which after centring is x = 0, y = 0, and the front of the box.
    const panel = { face: "front", layer: "shell", box: { x: [0, 300], y: [0, 18], z: [0, 400] } };
    const f = { ...PLUVIA, face: "front", at: { a: 150, b: 200 } };
    const mesh = placeDriver(new THREE.Mesh(), f, panel, E);
    expect(mesh.position.x).toBeCloseTo(0, 6);
    expect(mesh.position.y).toBeCloseTo(0, 6);
    expect(mesh.position.z).toBeCloseTo(E.y / 2 + SEAT, 6);
  });

  it("seats proud on the far side of the box too, not into it", () => {
    const panel = { face: "back", layer: "shell", box: { x: [0, 300], y: [282, 300], z: [0, 400] } };
    const f = { ...PLUVIA, face: "back", at: { a: 150, b: 200 } };
    const mesh = placeDriver(new THREE.Mesh(), f, panel, E);
    // The back is the model's +y, which is the scene's −z: proud means further
    // negative, and getting the sign wrong here buries it inside the box.
    expect(mesh.position.z).toBeCloseTo(-(E.y / 2 + SEAT), 6);
  });
});

describe("§22 which fittings get drawn", () => {
  const panel = { face: "front", layer: "shell", box: { x: [0, 300], y: [0, 18], z: [0, 400] } };

  it("is the drivers, and not the ports", () => {
    const fittings = [
      { ...PLUVIA, id: "a", face: "front", at: { a: 100, b: 100 } },
      { type: "port", id: "b", face: "front", diameter: 68, at: { a: 200, b: 100 } },
    ];
    const drawn = driversOn(fittings, { front: panel });
    expect(drawn).toHaveLength(1);
    expect(drawn[0].fitting.id).toBe("a");
    expect(drawn[0].panel).toBe(panel);
  });

  it("skips a driver on a face with no panel, rather than throwing", () => {
    // A fitting can name a face the box has nothing on — the messages say so,
    // and the view still has to draw.
    const orphan = [{ ...PLUVIA, id: "c", face: "top", at: { a: 1, b: 1 } }];
    expect(driversOn(orphan, { front: panel })).toEqual([]);
    expect(driversOn(undefined, { front: panel })).toEqual([]);
  });
});

/**
 * §22 One driver shape, every driver.
 *
 * Asked directly: does it still look like a driver at 2 inches and at 15? The
 * shape is proportions of the two numbers a datasheet gives, so it should — but
 * "should" is what a test is for, and a number being typed passes through every
 * value on its way to the one that was meant.
 */
describe("§22 the shape scales across every driver somebody might fit", () => {
  // Cutout and frame diameter, off manufacturers' drawings.
  const REAL = [
    ["2in micro", 45, 57], ["3in full range", 68, 80], ["4in Pluvia", 100, 122.3],
    ["5.25in", 116, 140], ["6.5in", 146, 170], ["8in", 184, 218],
    ["10in", 230, 270], ["12in", 277, 315], ["15in woofer", 350, 390],
  ];

  it("§24 takes its depth from the datasheet, not from its diameter", () => {
    // Depth does not scale with diameter across driver classes — a small
    // full-range driver is relatively deep and a shallow woofer relatively
    // flat — so it is a number somebody types. Two drivers of quite different
    // face sizes, both 71.5 mm from mounting face to magnet, come out the same
    // depth apart from their frames.
    const backOf = (p) => Math.min(...p.map(([, h]) => h));
    const four = driverProfile({ ...DEFAULT_DRIVER, cutout: 100, outer: 122.3, depth: 71.5, magnet: 75.8, magnetDepth: 37 });
    const six = driverProfile({ ...DEFAULT_DRIVER, cutout: 146, outer: 170, depth: 71.5, magnet: 100, magnetDepth: 37 });
    // What differs is the frame thickness they are measured from, and nothing
    // else: about 1.8 mm between a 122 mm frame and a 170 mm one.
    expect(Math.abs(backOf(four) - backOf(six))).toBeLessThan(3);
    // And the depth given is honoured, front of frame to back of magnet.
    const frontOfFrame = (f) => driverOuter(f) * DRIVER_SHAPE.flange;
    const spec = { ...DEFAULT_DRIVER, cutout: 100, outer: 122.3, depth: 71.5, magnet: 75.8, magnetDepth: 37 };
    expect(frontOfFrame(spec) - backOf(four)).toBeCloseTo(71.5, 6);
  });

  it("§24 will not draw a body shallower than the cone inside it", () => {
    // A 15 inch driver cannot be 60 mm deep: its cone is 73 mm on its own. The
    // body is clamped so what is drawn is still a driver, and the message says
    // the number is wrong rather than the picture quietly being something else.
    const wrong = { ...DEFAULT_DRIVER, cutout: 350, outer: 390, depth: 60, magnet: 100, magnetDepth: 25 };
    const profile = driverProfile(wrong);
    const cap = profile.at(-1)[1];
    expect(Math.min(...profile.map(([, h]) => h))).toBeLessThan(cap);
    const panel = { face: "front", layer: "shell", box: { x: [0, 600], y: [0, 18], z: [0, 700] } };
    const msgs = fittingIssues([{ ...wrong, id: "w", face: "front", at: { a: 300, b: 350 } }],
      [panel], { front: panel }, null);
    expect(msgs.some((m) => /shallower than its own cone/.test(m.text))).toBe(true);
  });

  it("draws a closed body, the width of its frame, at every size", () => {
    for (const [name, cutout, outer] of REAL) {
      const f = { ...DEFAULT_DRIVER, cutout, outer };
      const profile = driverProfile(f);
      expect(profile[0][0], name).toBe(0);
      expect(profile.at(-1)[0], name).toBeCloseTo(0, 9);
      expect(Math.max(...profile.map(([r]) => r)), name).toBeCloseTo(outer / 2, 9);
    }
  });

  it("keeps every proportion in step with the driver's own size", () => {
    // The test that would catch a stray absolute millimetre: quadruple the
    // driver and every part of it quadruples, so a 15 inch reads the same as a
    // 3 inch. §24 scales the depths with it too — they are given numbers rather
    // than proportions now, so a driver four times the size is only four times
    // the size if its datasheet says so.
    const at = (k) => ({
      ...DEFAULT_DRIVER, cutout: 50 * k, outer: 61.15 * k,
      depth: 40 * k, magnet: 37.5 * k, magnetDepth: 18 * k, coneDepth: 10.5 * k,
    });
    const small = driverProfile(at(1));
    const big = driverProfile(at(4));
    // Everything scales except the slop, which is deliberately absolute: it is
    // a workshop clearance, not a proportion, so quadrupling the driver leaves
    // it where it was and the two profiles differ by that much and no more.
    const tolerance = DRIVER_SHAPE.slop * 4;
    for (let i = 0; i < small.length; i++) {
      expect(Math.abs(big[i][0] - small[i][0] * 4)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(big[i][1] - small[i][1] * 4)).toBeLessThanOrEqual(tolerance);
    }
    // And the parts that carry no clearance scale exactly.
    expect(big.at(-1)[1]).toBeCloseTo(small.at(-1)[1] * 4, 6);
    expect(Math.max(...big.map(([r]) => r))).toBeCloseTo(Math.max(...small.map(([r]) => r)) * 4, 6);
  });

  it("stands further proud the bigger it gets, and never sinks in", () => {
    let last = 0;
    for (const [name, cutout, outer] of REAL) {
      const proud = driverStandoff({ ...DEFAULT_DRIVER, cutout, outer });
      expect(proud, name).toBeGreaterThan(last);
      last = proud;
    }
  });

  it("keeps the frame clear of the hole at every size", () => {
    for (const [name, cutout, outer] of REAL) {
      const profile = driverProfile({ ...DEFAULT_DRIVER, cutout, outer });
      for (const [r, h] of profile) {
        if (h < 0) expect(r, name).toBeLessThanOrEqual(cutout / 2 - DRIVER_SHAPE.slop + 1e-9);
      }
    }
  });
});

describe("§22 a frame narrower than its own cutout", () => {
  const impossible = { ...DEFAULT_DRIVER, cutout: 100, outer: 8 };

  it("still draws something that is a driver, rather than a knot", () => {
    // A number being typed passes through every value on the way: "8" on the
    // road to "80" turned the contour inside out, and the body came out as a
    // self-intersecting mess rather than as anything.
    const profile = driverProfile(impossible);
    expect(profile[1][0]).toBeGreaterThanOrEqual(profile[0][0]);
    expect(profile[3][0]).toBeGreaterThanOrEqual(profile[2][0]);
    // Clamped to the hole it covers, and no wider.
    expect(Math.max(...profile.map(([r]) => r))).toBeCloseTo(impossible.cutout / 2, 9);
    for (const [r, h] of profile) {
      expect(Number.isFinite(r) && Number.isFinite(h)).toBe(true);
    }
  });

  it("is still called what it is", () => {
    const panel = { face: "front", layer: "shell", box: { x: [0, 300], y: [0, 18], z: [0, 400] } };
    const f = { ...impossible, id: "x", face: "front", at: { a: 150, b: 200 } };
    const msgs = fittingIssues([f], [panel], { front: panel }, null);
    expect(msgs.some((m) => m.level === "error" && /fall through the hole/.test(m.text))).toBe(true);
  });
});

/**
 * §27 What the driver takes out of the box.
 *
 * A box sized for twelve litres of air does not hold twelve litres of air once
 * a driver's basket and motor are standing in it. The displacement is
 * integrated over the profile that is drawn rather than guessed at, so the two
 * can never disagree — and an integration is worth checking against shapes
 * whose volume is known without one.
 */
describe("§27 revolving a profile into a volume", () => {
  const closeTo = (a, b) => expect(a).toBeCloseTo(b, 3);

  it("gets a cylinder right", () => {
    // r = 10, h = 20, traced as a closed loop: πr²h = 6283.185…
    const cylinder = [[0, 0], [10, 0], [10, 20], [0, 20]];
    closeTo(Math.abs(revolvedVolume(cylinder)), Math.PI * 100 * 20);
  });

  it("gets a cone right, which a cylinder would not catch", () => {
    // A third of the cylinder that contains it — the case that fails if the
    // frustum term is wrong and only the end radii are used.
    const cone = [[0, 0], [10, 0], [0, 20]];
    closeTo(Math.abs(revolvedVolume(cone)), (Math.PI * 100 * 20) / 3);
  });

  it("gets a frustum right", () => {
    const frustum = [[0, 0], [10, 0], [5, 20], [0, 20]];
    closeTo(Math.abs(revolvedVolume(frustum)), (Math.PI * 20 / 3) * (100 + 50 + 25));
  });

  it("does not care which way round the loop was traced", () => {
    const cylinder = [[0, 0], [10, 0], [10, 20], [0, 20]];
    closeTo(Math.abs(revolvedVolume([...cylinder].reverse())), Math.abs(revolvedVolume(cylinder)));
  });
});

describe("§27 clipping the profile at the baffle", () => {
  it("keeps what is behind it and closes the cut flat", () => {
    // A cylinder from -10 to +10, cut at 0, is half a cylinder.
    const cylinder = [[0, -10], [10, -10], [10, 10], [0, 10]];
    const below = clipBelow(cylinder, 0);
    expect(Math.max(...below.map(([, h]) => h))).toBe(0);
    expect(Math.abs(revolvedVolume(below))).toBeCloseTo(Math.PI * 100 * 10, 3);
  });

  it("keeps everything when everything is behind it, and nothing when nothing is", () => {
    const back = [[0, -20], [10, -20], [10, -5], [0, -5]];
    expect(Math.abs(revolvedVolume(clipBelow(back, 0)))).toBeCloseTo(Math.PI * 100 * 15, 3);
    const front = back.map(([r, h]) => [r, h + 40]);
    expect(clipBelow(front, 0)).toHaveLength(0);
  });
});

describe("§27 how much a fitting displaces", () => {
  const PLUVIA_FULL = { ...PLUVIA, depth: 71.5, magnet: 75.8, magnetDepth: 37, coneDepth: 21 };

  it("counts only what is behind the baffle", () => {
    const all = Math.abs(revolvedVolume(driverProfile(PLUVIA_FULL)));
    const inside = driverDisplacement(PLUVIA_FULL);
    expect(inside).toBeGreaterThan(0);
    // The frame and the surround stand proud, so the part inside is less.
    expect(inside).toBeLessThan(all);
  });

  it("grows with the driver, and with its depth", () => {
    const deeper = driverDisplacement({ ...PLUVIA_FULL, depth: 100 });
    expect(deeper).toBeGreaterThan(driverDisplacement(PLUVIA_FULL));
    const bigger = driverDisplacement({ ...PLUVIA_FULL, magnet: 100 });
    expect(bigger).toBeGreaterThan(driverDisplacement(PLUVIA_FULL));
  });

  it("takes the datasheet's own figure over its own arithmetic", () => {
    // A real basket is half air between the spokes and the drawn one is solid,
    // so the integration is an upper bound. Where Vd is published, it wins.
    expect(driverDisplacement({ ...PLUVIA_FULL, displaces: 200000 })).toBe(200000);
    expect(driverDisplacement({ ...PLUVIA_FULL, displaces: 0 })).toBe(0);
  });

  it("takes a port's whole outside, bore and all", () => {
    // The bore is open to the outside, so it is not the box's air either.
    const port = { type: "port", diameter: 68, wall: 3, length: 150, tube: true };
    expect(portDisplacement(port)).toBeCloseTo(Math.PI * 37 * 37 * 150, 3);
    // And a port with no tube behind it takes nothing.
    expect(portDisplacement({ ...port, tube: false })).toBe(0);
  });
});

/**
 * §28 Vd is the datasheet's word for it, and the better number.
 *
 * The arithmetic of §27 draws a basket solid where a real one is half air, so
 * it over-states what a driver takes out of a box. That matters for the figure
 * it feeds: an over-stated displacement makes the air left over read *low*, so
 * what the readout shows is a floor rather than an estimate scattered either
 * side of the truth. Which of the two it got has to be answerable.
 */
describe("§28 a given Vd against a worked-out one", () => {
  const PLUVIA_FULL = { ...PLUVIA, depth: 71.5, magnet: 75.8, magnetDepth: 37, coneDepth: 21 };

  it("knows whether it was given one", () => {
    expect(hasVd(PLUVIA_FULL)).toBe(false);
    expect(hasVd({ ...PLUVIA_FULL, displaces: 180000 })).toBe(true);
    // Zero is a given figure, not a missing one: a driver can displace nothing
    // worth counting and saying so is different from saying nothing.
    expect(hasVd({ ...PLUVIA_FULL, displaces: 0 })).toBe(true);
    expect(hasVd({ ...PLUVIA_FULL, displaces: -1 })).toBe(false);
    expect(hasVd({ ...PLUVIA_FULL, displaces: null })).toBe(false);
  });

  it("uses the given one over its own", () => {
    const worked = driverDisplacement(PLUVIA_FULL);
    expect(driverDisplacement({ ...PLUVIA_FULL, displaces: 180000 })).toBe(180000);
    // And the two differ, or there would be nothing to prefer.
    expect(worked).not.toBe(180000);
  });

  it("over-states rather than under-states, which is why the net is a floor", () => {
    // The whole justification for showing "≥": a real Pluvia 7P is nearer
    // 0.2 litres than the third of a litre the solid basket comes to.
    const worked = driverDisplacement(PLUVIA_FULL);
    expect(worked).toBeGreaterThan(200000);
    expect(worked).toBeLessThan(500000);
  });
});
