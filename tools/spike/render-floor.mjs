// §54 How far below the floor an exploded box reaches.
//
// The render view stands the box on a sweep whose floor is y = 0, lifting the
// group by E.z/2 so the bottom of the box lands there. Exploding moves each
// panel out along its own face normal — and the bottom panels go down.
import { DEFAULT_DESIGN, derive, addPanel } from "../../src/ui/design.js";
import { explodeOffset } from "../../src/three/panelGeometry.js";
import { EXPLODE_SCALE, explodeSink } from "../../src/model/explode.js";
import { FACES } from "../../src/model/constants.js";

let d = DEFAULT_DESIGN;
for (const f of FACES) d = addPanel(d, "cladding", f);
for (const f of FACES) d = addPanel(d, "doubler", f);
for (const f of FACES) d = addPanel(d, "lagging", f);
const { sol } = derive(d);
const E = sol.E;

console.log("scales:", EXPLODE_SCALE);
for (const explode of [0, 20, 60, 120]) {
  // The geometry is centred on the box's middle; the group stands at
  // E.z/2 − sink, which is what §54 changed.
  const sink = explodeSink(sol.panels, explode);
  const stand = E.z / 2 - sink;
  let was = Infinity, now = Infinity, who = null;
  for (const p of sol.panels) {
    const [, dy] = explodeOffset(p, explode);
    const y = p.box.z[0] - E.z / 2 + dy;                  // in the group
    if (y + E.z / 2 < was) { was = y + E.z / 2; who = `${p.layer}|${p.face}`; }
    now = Math.min(now, y + stand);
  }
  console.log(`explode ${String(explode).padStart(3)}  lowest piece ${who.padEnd(16)}`,
    `was ${was.toFixed(1).padStart(7)} mm`, was < -1e-9 ? "THROUGH THE FLOOR" : "on the floor   ",
    ` now ${now.toFixed(1).padStart(6)} mm`, Math.abs(now) < 1e-9 ? "on the floor" : "OFF THE FLOOR");
}
