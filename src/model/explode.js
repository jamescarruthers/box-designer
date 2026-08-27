// §38 How far a panel moves when the assembly is exploded.
//
// One rule, two consumers: the 3D view and the drawing's isometric. A box that
// is exploded on screen and exploded on the sheet should come apart the same
// way, or the drawing is of a different box.

import { AXIS, AXES } from "./constants.js";

/**
 * Outward along the face normal, scaled by layer so a stack comes apart in
 * the order it was built: cladding leaves first and furthest, then the
 * carcass, then the doubler and the lining, which barely move — they are
 * inside, and a lining that flew further than its own board would read as
 * being on the wrong side of it.
 */
export const EXPLODE_SCALE = { cladding: 1.5, shell: 1.0, doubler: 0.45, lagging: 0.2 };

/** The shift in model coordinates: x right, y back, z up. */
export function explodeShift(panel, amount) {
  const [a, s] = AXIS[panel.face];
  const d = s * amount * (EXPLODE_SCALE[panel.layer] ?? 1);
  return { x: 0, y: 0, z: 0, [a]: d };
}

/**
 * §55 The box an exploded assembly occupies, in model coordinates.
 *
 * Not the envelope: the envelope is where the box is when it is together, and
 * a box that has come apart reaches past it — by 1.5× the amount asked for on
 * the cladding, and by nothing at all on a face that carries none. Which is
 * why this is measured rather than derived from `E`: a box clad on the front
 * only comes apart lopsidedly, and the middle of what you are looking at is
 * not the middle of the box it was.
 */
export function explodedBounds(panels, amount) {
  const out = Object.fromEntries(AXES.map((b) => [b, [Infinity, -Infinity]]));
  for (const p of panels) {
    const box = explodedBox(p, amount);
    for (const b of AXES) {
      out[b][0] = Math.min(out[b][0], box[b][0]);
      out[b][1] = Math.max(out[b][1], box[b][1]);
    }
  }
  return out;
}

/** The middle of that box, which is what a camera looking at the thing aims at. */
export const explodedCentre = (panels, amount) => {
  const b = explodedBounds(panels, amount);
  return Object.fromEntries(AXES.map((k) => [k, (b[k][0] + b[k][1]) / 2]));
};

/**
 * §54 How far the lowest piece of an exploded assembly reaches below the floor
 * the box stands on, as a number that is zero or negative.
 *
 * The envelope stands on z = 0, so an un-exploded box's lowest point is 0. Once
 * it comes apart the bottom panels move down along their own normals — the
 * bottom cladding by 1.5× the amount asked for — and anything standing the box
 * on a floor has to stand it on *this* instead of on its underside, or the
 * pieces that moved go through the floor.
 */
export const explodeSink = (panels, amount) =>
  Math.min(0, explodedBounds(panels, amount).z[0]);

/** The same shift applied to a panel's box, which is what the views draw. */
export function explodedBox(panel, amount) {
  if (!(amount > 0)) return panel.box;
  const d = explodeShift(panel, amount);
  return {
    x: [panel.box.x[0] + d.x, panel.box.x[1] + d.x],
    y: [panel.box.y[0] + d.y, panel.box.y[1] + d.y],
    z: [panel.box.z[0] + d.z, panel.box.z[1] + d.z],
  };
}
