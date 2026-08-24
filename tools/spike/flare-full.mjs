// §34 How close to the full thickness will OCCT run a flare? §29 measured in
// half-millimetres and found the wall thickness itself refused; the question
// now is whether the refusal is at the thickness or a hair short of it.
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { newFitting, fittingOwners } from "../../src/model/fittings.js";
import { cutFittings, panelBox, volumeOf } from "../../src/occt/solids.js";

const oc = await initOpenCascade();

function builds({ thickness, bolts, type, radius, cutout = 116 }) {
  const sol = solve({ envelope: { x: 500, y: 400, z: 500 }, thickness });
  const panel = fittingOwners(sol.panels, ["front"]).front;
  const f = { ...newFitting("driver", "front", { a: 250, b: 250 }), cutout, bolts,
    flare: { type, radius } };
  try {
    const v = volumeOf(oc, cutFittings(oc, panelBox(oc, panel), panel, [f]));
    return Number.isFinite(v) && v > 0;
  } catch { return false; }
}

// Fine sweep up to and past the thickness, on a panel with no bolt holes to
// graze — the other limit (§29) is a separate question.
for (const thickness of [9, 12, 18, 25]) {
  for (const type of ["fillet", "chamfer"]) {
    const steps = [];
    for (const d of [1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0, -0.01]) {
      const radius = Number((thickness - d).toFixed(3));
      steps.push(`${d === 0 ? "t" : d > 0 ? `t-${d}` : `t+${-d}`}:${builds({ thickness, bolts: 0, type, radius }) ? "ok" : "X"}`);
    }
    console.log(String(thickness).padStart(2), "mm", type.padEnd(8), steps.join("  "));
  }
}
