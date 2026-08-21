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
  driverStandoff, fittingOrigin,
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
