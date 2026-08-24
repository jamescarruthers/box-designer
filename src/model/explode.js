// §38 How far a panel moves when the assembly is exploded.
//
// One rule, two consumers: the 3D view and the drawing's isometric. A box that
// is exploded on screen and exploded on the sheet should come apart the same
// way, or the drawing is of a different box.

import { AXIS } from "./constants.js";

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
