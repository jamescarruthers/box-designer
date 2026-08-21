// §29 The first sweep said 18 mm takes a smaller flare than 12 mm or 25 mm,
// which cannot be a rule about thickness. The suspect is the bolt circle: the
// flare opens the rim outward as it goes back, and the default driver's holes
// sit 13 mm out from the cutout. Sweep with them and without.
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { newFitting, fittingOwners } from "../../src/model/fittings.js";
import { cutFittings, panelBox, volumeOf } from "../../src/occt/solids.js";

const oc = await initOpenCascade();

function run({ thickness = 18, cutout = 116, bolts = 5, type, radius }) {
  const sol = solve({ envelope: { x: 400, y: 300, z: 400 }, thickness });
  const panel = fittingOwners(sol.panels, ["front"]).front;
  const f = { ...newFitting("driver", "front", { a: 200, b: 200 }), cutout, bolts,
    flare: { type, radius } };
  try {
    const v = volumeOf(oc, cutFittings(oc, panelBox(oc, panel), panel, [f]));
    return Number.isFinite(v) && v > 0;
  } catch { return false; }
}

const largest = (opts) => {
  let last = 0;
  for (let r = 0.5; r <= opts.thickness * 1.2; r += 0.5) if (run({ ...opts, radius: r })) last = r;
  return last;
};

console.log("largest flare that builds, by thickness (⌀116 cutout, 147 PCD):");
for (const thickness of [9, 12, 15, 18, 22, 25]) {
  const withBolts = { fillet: largest({ thickness, type: "fillet" }), chamfer: largest({ thickness, type: "chamfer" }) };
  const bare = { fillet: largest({ thickness, bolts: 0, type: "fillet" }), chamfer: largest({ thickness, bolts: 0, type: "chamfer" }) };
  console.log(`  ${String(thickness).padStart(2)} mm   with bolts  fillet ${String(withBolts.fillet).padStart(5)}  chamfer ${String(withBolts.chamfer).padStart(5)}` +
    `   |  no bolts  fillet ${String(bare.fillet).padStart(5)}  chamfer ${String(bare.chamfer).padStart(5)}`);
}
