// §29 Does the guard hold? For a spread of panels and drivers, the largest
// flare the rule allows should build, and the next half-millimetre is where it
// is entitled to fail.
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { newFitting, fittingOwners, largestFlare } from "../../src/model/fittings.js";
import { cutFittings, panelBox, volumeOf } from "../../src/occt/solids.js";

const oc = await initOpenCascade();

function builds({ thickness, driver, type, radius }) {
  const sol = solve({ envelope: { x: 500, y: 400, z: 500 }, thickness });
  const panel = fittingOwners(sol.panels, ["front"]).front;
  const f = { ...newFitting("driver", "front", { a: 250, b: 250 }), ...driver, flare: { type, radius } };
  try {
    const v = volumeOf(oc, cutFittings(oc, panelBox(oc, panel), panel, [f]));
    return Number.isFinite(v) && v > 0;
  } catch { return false; }
}

// §34 With the bolts stopped short (§33) there is no bolt circle in the panel
// being flared, and the cap becomes the full thickness — the case this sweep
// exists to check, since it is the largest flare the app will now offer.
const DRIVERS = [
  ["Pluvia 7P   ", { cutout: 116, pcd: 147, bolts: 5, boltHole: 5 }],
  ["3 inch      ", { cutout: 58, pcd: 76, bolts: 4, boltHole: 4 }],
  ["8 inch      ", { cutout: 185, pcd: 218, bolts: 8, boltHole: 6 }],
  ["15 inch     ", { cutout: 350, pcd: 370, bolts: 8, boltHole: 8 }],
  ["no bolts    ", { cutout: 116, pcd: 147, bolts: 0, boltHole: 5 }],
  ["15in, bare  ", { cutout: 350, pcd: 370, bolts: 0, boltHole: 8 }],
  ["3in, bare   ", { cutout: 58, pcd: 76, bolts: 0, boltHole: 4 }],
];

let bad = 0;
for (const [name, driver] of DRIVERS) {
  for (const thickness of [9, 12, 18, 25]) {
    const cap = largestFlare(driver, thickness);
    const row = [];
    for (const type of ["fillet", "chamfer"]) {
      const at = cap > 0 ? builds({ thickness, driver, type, radius: cap }) : true;
      if (!at) bad++;
      row.push(`${type} @${String(cap).padStart(5)} ${at ? "ok" : "REFUSED"}`);
    }
    console.log(`${name} ${String(thickness).padStart(2)} mm   ${row.join("   ")}`);
  }
}
console.log(bad ? `\n${bad} allowed flares the kernel would not build` : "\nevery flare the rule allows builds");
