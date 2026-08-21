// §22 Drawing the driver.
//
// A box with a hundred-millimetre hole in it is a box with a hole in it. The
// thing being designed is a speaker, and the driver is the part of it anybody
// looking at the picture is looking for — so with the frame diameter known
// (§22) there is enough to put one on the panel.
//
// Revolved from the profile in `fittings.js`, which is where the arithmetic
// lives so it can be checked without a GPU. This file is the placing: getting
// it on the right face, pointing the right way out.

import * as THREE from "three";
import { AXIS } from "../model/constants.js";
import { toThree } from "./panelGeometry.js";
import { driverProfile, driverConeFrom, fittingOrigin } from "../model/fittings.js";

/**
 * How the driver behaves in light.
 *
 * Nothing about a driver is the colour of a sheet of ply. A paper cone is matte
 * and light; a cast or pressed frame is dark and a little tighter than the
 * board around it. Two materials rather than one, because a driver rendered all
 * in one tone reads as a plug in a hole.
 */
export const DRIVER_SURFACE = {
  frame: { colour: "#1c1c1f", roughness: 0.42, metalness: 0.25 },
  cone: { colour: "#cfc7b4", roughness: 0.88, metalness: 0 },
};

/** How finely the body is revolved. 64 is round at any size it is drawn at. */
export const SEGMENTS = 64;

/**
 * A hair proud of the panel, in millimetres.
 *
 * The underside of the frame and the face of the panel are the same plane, and
 * two surfaces in the same plane flicker against each other wherever both are
 * drawn. Lifting the driver by a twentieth of a millimetre settles it and is
 * two orders of magnitude below anything anyone can see.
 */
export const SEAT = 0.05;

/**
 * The driver's body, revolved and left standing on the origin, pointing +y.
 *
 * The profile's height is the lathe's y, so the body comes out of `LatheGeometry`
 * already facing up the axis it will be turned onto.
 */
export function driverBody(fitting, segments = SEGMENTS, steps = 8) {
  const profile = driverProfile(fitting, steps);
  const geometry = new THREE.LatheGeometry(
    profile.map(([r, h]) => new THREE.Vector2(r, h)), segments);
  geometry.computeVertexNormals();

  // Two tones from one geometry, painted on rather than cut into separate
  // meshes. A lathe lays its vertices out as a grid — one row per profile
  // point, one column per segment — so which part of the driver a vertex
  // belongs to is its position in the profile, and nothing has to be worked out
  // from triangle indices. Vertex colours are how the rest of the scene carries
  // this (§19), so the path tracer finds them without being told.
  const cone = driverConeFrom(steps);
  const rows = profile.length;
  const count = geometry.getAttribute("position").count;
  const colours = new Float32Array(count * 3);
  const frame = new THREE.Color(DRIVER_SURFACE.frame.colour);
  const paper = new THREE.Color(DRIVER_SURFACE.cone.colour);
  for (let i = 0; i < count; i++) {
    const c = (i % rows) >= cone ? paper : frame;
    colours[i * 3] = c.r; colours[i * 3 + 1] = c.g; colours[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/**
 * The material a driver is drawn with.
 *
 * White, because the colour is in the vertices: a paper cone and a cast frame
 * are two very different things to look at and one mesh has to show both. The
 * finish splits the difference — matte enough for paper, tight enough for the
 * frame not to look like cardboard.
 */
export function driverMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.6, metalness: 0.05,
  });
}

/**
 * Which way a face points, in the scene's coordinates rather than the model's.
 *
 * These are not the same coordinates and the difference is not an axis swap:
 * `toThree` is a rotation, taking the model's z to the scene's height and the
 * model's y to its −z, and re-centring the box on the origin while it is at it
 * (§4.3). A driver aimed along the model's own axes comes out lying on its side
 * a box-width away from where it belongs, which is exactly what it did.
 *
 * Derived by pushing a unit step along the face's model normal through the same
 * transform the panels go through, so the two cannot drift apart.
 */
export function faceNormal(face) {
  const [axis, sign] = AXIS[face];
  const step = { x: 0, y: 0, z: 0 };
  step[axis] = sign;
  // A direction, not a point, so it goes through with the box size zeroed —
  // the centring term is a translation and directions do not take those.
  return new THREE.Vector3(...toThree([step.x, step.y, step.z], { x: 0, y: 0, z: 0 }));
}

/**
 * Turn a body built along +y so it points out of a given face.
 *
 * From the direction rather than by cases: six faces written out as six
 * rotations is six chances to get a sign backwards, and the symptom of one is a
 * driver aimed into the cavity — where the only sign of it on screen is that
 * nothing is there. A body of revolution has no orientation about its own axis
 * to lose, so the arbitrary roll `setFromUnitVectors` picks for a face pointing
 * straight down costs nothing.
 */
export function aimAt(object, face) {
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), faceNormal(face));
  return object;
}

/**
 * A driver, placed on the panel it is bolted to.
 *
 * `origin` comes from `fittingOrigin`, which is already the point on the outer
 * surface of that panel — so all that is left is to sit the body on it and turn
 * it to face out.
 */
export function placeDriver(mesh, fitting, panel, E) {
  const { x, y, z, axis, sign } = fittingOrigin(fitting, panel);
  const at = { x, y, z };
  at[axis] += sign * SEAT;
  // Through the same transform the panels take, or the driver sits in model
  // coordinates in a scene that is not in them.
  mesh.position.set(...toThree([at.x, at.y, at.z], E));
  return aimAt(mesh, fitting.face);
}

/** Every driver on a set of panels, as `{ fitting, panel }`. */
export function driversOn(fittings, owners) {
  return (fittings ?? [])
    .filter((f) => f.type === "driver" && owners?.[f.face])
    .map((f) => ({ fitting: f, panel: owners[f.face] }));
}
